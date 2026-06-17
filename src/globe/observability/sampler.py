from __future__ import annotations

import asyncio
from pathlib import Path

from globe.database.sync import ReplicationEngine
from globe.observability.store import ObservabilityStore
from globe.routing.geo_router import GeoRouter


class MetricsSampler:
    def __init__(
        self,
        store: ObservabilityStore,
        cluster: object,
        router: GeoRouter,
        replicator: ReplicationEngine,
        llm,
        interval_s: float = 30.0,
    ) -> None:
        self.store = store
        self.cluster = cluster
        self.router = router
        self.replicator = replicator
        self.llm = llm
        self.interval_s = interval_s
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        if self._task:
            return
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _loop(self) -> None:
        while True:
            try:
                await self.sample_once()
            except Exception:
                pass
            await asyncio.sleep(self.interval_s)

    async def sample_once(self) -> None:
        for probe in self.router.snapshot():
            self.store.record_metric(
                "latency_ms",
                probe.latency_ms if probe.latency_ms != float("inf") else 9999.0,
                region_id=probe.region_id,
                labels={"healthy": probe.healthy, "circuit": probe.circuit.value},
            )
        status = self.replicator.status()
        self.store.record_metric("sync_cycles", float(status.get("cycles") or 0))
        self.store.record_metric(
            "sync_lag",
            float(status.get("last_entries_applied") or 0),
        )
        cache = self.llm.stats()
        self.store.record_metric("cache_hit_rate", float(cache.get("hit_rate") or 0))
        for db in self.cluster.regions.values():
            stats = db.stats()
            self.store.record_metric(
                "order_count",
                float(stats["orders"]),
                region_id=db.region_id,
            )


def observability_path(data_dir: Path) -> Path:
    return data_dir / "observability.sqlite"
