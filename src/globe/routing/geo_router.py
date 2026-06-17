from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Optional

from globe.config import get_settings
from globe.database.models import REGIONS, RegionConfig
from globe.database.peer import PeerClient


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class RegionHealth:
    region_id: str
    healthy: bool
    latency_ms: float
    circuit: CircuitState
    last_checked: float
    error_rate: float
    is_local: bool = False
    peer_url: Optional[str] = None


@dataclass
class GeoRouter:
    """Routes requests to the nearest healthy region via HTTP health probes."""

    deployment_mode: str = "regional"
    local_region_id: str = "us-east-1"
    peer_clients: Dict[str, PeerClient] = field(default_factory=dict)
    failure_threshold: int = 3
    recovery_timeout_s: float = 8.0
    _failures: dict = field(default_factory=dict)
    _opened_at: dict = field(default_factory=dict)
    _health: dict = field(default_factory=dict)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def probe_region(
        self, region: RegionConfig, client_lat: float, client_lon: float
    ) -> RegionHealth:
        async with self._lock:
            circuit = self._circuit_state(region.id)
            if circuit == CircuitState.OPEN:
                return RegionHealth(
                    region_id=region.id,
                    healthy=False,
                    latency_ms=float("inf"),
                    circuit=circuit,
                    last_checked=time.time(),
                    error_rate=1.0,
                    is_local=region.id == self.local_region_id,
                    peer_url=self._peer_url(region.id),
                )

        is_local = region.id == self.local_region_id and self.deployment_mode != "gateway"
        peer = self.peer_clients.get(region.id)
        settings = get_settings()

        if self.deployment_mode == "regional" and region.id == self.local_region_id:
            latency = 5.0
            failed = False
        elif peer is not None:
            healthy, latency = await peer.probe_health()
            failed = not healthy
        elif settings.is_development and self.deployment_mode != "gateway":
            latency = region.base_latency_ms
            failed = False
        else:
            latency = float("inf")
            failed = True

        async with self._lock:
            if failed:
                self._failures[region.id] = self._failures.get(region.id, 0) + 1
                if self._failures[region.id] >= self.failure_threshold:
                    self._opened_at[region.id] = time.time()
            else:
                self._failures[region.id] = 0
                self._opened_at.pop(region.id, None)

            circuit = self._circuit_state(region.id)
            healthy = circuit != CircuitState.OPEN and not failed
            health = RegionHealth(
                region_id=region.id,
                healthy=healthy,
                latency_ms=latency if healthy else float("inf"),
                circuit=circuit,
                last_checked=time.time(),
                error_rate=min(
                    self._failures.get(region.id, 0) / self.failure_threshold, 1.0
                ),
                is_local=is_local,
                peer_url=self._peer_url(region.id),
            )
            self._health[region.id] = health
            return health

    def _peer_url(self, region_id: str) -> Optional[str]:
        peer = self.peer_clients.get(region_id)
        return peer.base_url if peer else None

    def _circuit_state(self, region_id: str) -> CircuitState:
        failures = self._failures.get(region_id, 0)
        opened_at = self._opened_at.get(region_id)
        if opened_at is None:
            return CircuitState.CLOSED
        if time.time() - opened_at >= self.recovery_timeout_s:
            return CircuitState.HALF_OPEN
        if failures >= self.failure_threshold:
            return CircuitState.OPEN
        return CircuitState.CLOSED

    async def route(
        self, client_lat: float, client_lon: float, preferred_region: str | None = None
    ) -> tuple[RegionConfig, list[RegionHealth]]:
        probes = await asyncio.gather(
            *(self.probe_region(region, client_lat, client_lon) for region in REGIONS)
        )
        healthy = [p for p in probes if p.healthy]

        if preferred_region:
            preferred = next((r for r in REGIONS if r.id == preferred_region), None)
            preferred_health = next(
                (p for p in probes if p.region_id == preferred_region), None
            )
            if preferred and preferred_health and preferred_health.healthy:
                return preferred, probes

        if not healthy:
            fallback = min(REGIONS, key=lambda r: r.base_latency_ms)
            return fallback, probes

        best = min(healthy, key=lambda p: p.latency_ms)
        region = next(r for r in REGIONS if r.id == best.region_id)
        return region, probes

    def snapshot(self) -> list[RegionHealth]:
        return list(self._health.values())
