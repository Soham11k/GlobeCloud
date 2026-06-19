from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

import httpx

from globe.database.peer import PeerClient


def format_proxy_error(exc: httpx.HTTPError) -> str:
    """Return a user-friendly message for gateway proxy failures."""
    raw = str(exc.args[0]) if getattr(exc, "args", None) else str(exc)
    lower = raw.lower()
    if "connect" in lower or "connection refused" in lower or "timeout" in lower:
        return "Regional backend unreachable. Try again in a moment."
    if len(raw) > 180:
        return raw[:180] + "…"
    return raw


class GatewayProxy:
    """Proxies API requests to regional Fly backends and aggregates fleet status."""

    def __init__(
        self,
        peers: Dict[str, PeerClient],
        *,
        api_key: str = "",
        timeout_s: float = 30.0,
    ) -> None:
        self.peers = peers
        self.api_key = api_key
        self.timeout_s = timeout_s

    def get_peer(self, region_id: str) -> PeerClient:
        if region_id not in self.peers:
            raise KeyError(f"Unknown region: {region_id}")
        return self.peers[region_id]

    async def proxy_json(
        self,
        region_id: str,
        method: str,
        path: str,
        *,
        json_body: Any = None,
        params: Optional[dict] = None,
    ) -> Any:
        peer = self.get_peer(region_id)
        url = f"{peer.base_url}{path}"
        headers = peer._headers()
        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            response = await client.request(
                method,
                url,
                json=json_body,
                params=params,
                headers=headers,
            )
            if response.status_code >= 400:
                detail = response.text
                try:
                    detail = response.json().get("detail", detail)
                except Exception:
                    pass
                raise httpx.HTTPStatusError(
                    detail,
                    request=response.request,
                    response=response,
                )
            if response.status_code == 204 or not response.content:
                return {}
            return response.json()

    async def _region_status(self, region_id: str, peer: PeerClient) -> dict:
        healthy, latency_ms = await peer.probe_health()
        sync_data = {}
        if healthy:
            try:
                sync_data = await self.proxy_json(region_id, "GET", "/api/v1/sync/status")
            except httpx.HTTPError:
                sync_data = {}
        return {
            "region_id": region_id,
            "peer_url": peer.base_url,
            "healthy": healthy,
            "latency_ms": latency_ms,
            "sync": sync_data,
        }

    async def aggregate_global_status(self) -> dict:
        tasks = [
            self._region_status(region_id, peer)
            for region_id, peer in self.peers.items()
        ]
        regions = await asyncio.gather(*tasks)
        healthy_count = sum(1 for r in regions if r["healthy"])
        return {
            "status": "ok" if healthy_count > 0 else "degraded",
            "healthy_regions": healthy_count,
            "total_regions": len(regions),
            "regions": list(regions),
        }

    async def aggregate_metrics(self) -> dict:
        router = []
        for region_id, peer in self.peers.items():
            healthy, latency_ms = await peer.probe_health()
            router.append(
                {
                    "region_id": region_id,
                    "healthy": healthy,
                    "circuit": "closed" if healthy else "open",
                    "latency_ms": latency_ms if healthy else None,
                    "is_local": False,
                    "peer_url": peer.base_url,
                    "probe_mode": "http",
                }
            )
        return {
            "deployment_mode": "gateway",
            "local_region": None,
            "inference_cache": {"note": "proxied to regional nodes"},
            "router": router,
        }
