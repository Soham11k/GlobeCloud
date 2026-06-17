from __future__ import annotations

import time

import httpx


class PeerClient:
    """HTTP client for federating reads and replication with a remote region."""

    def __init__(
        self,
        region_id: str,
        base_url: str,
        *,
        api_key: str = "",
        replication_secret: str = "",
        timeout_s: float = 10.0,
    ) -> None:
        self.region_id = region_id
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.replication_secret = replication_secret
        self.timeout_s = timeout_s

    def _headers(self, *, replication: bool = False) -> dict:
        headers = {"Content-Type": "application/json"}
        if replication and self.replication_secret:
            headers["X-Replication-Secret"] = self.replication_secret
        elif self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    async def probe_health(self) -> tuple[bool, float]:
        start = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=self.timeout_s) as client:
                response = await client.get(
                    f"{self.base_url}/api/v1/health",
                    headers=self._headers(),
                )
                latency_ms = (time.perf_counter() - start) * 1000
                return response.status_code == 200, round(latency_ms, 2)
        except httpx.HTTPError:
            latency_ms = (time.perf_counter() - start) * 1000
            return False, round(latency_ms, 2)

    async def fetch_replication_log(self, since: int) -> list:
        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            response = await client.get(
                f"{self.base_url}/api/v1/replication/log",
                params={"since": since},
                headers=self._headers(replication=True),
            )
            response.raise_for_status()
            return response.json().get("entries", [])

    async def list_products(self) -> list:
        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            response = await client.get(
                f"{self.base_url}/api/v1/regions/{self.region_id}/products",
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json().get("products", [])

    async def list_knowledge(self) -> list:
        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            response = await client.get(
                f"{self.base_url}/api/v1/regions/{self.region_id}/knowledge",
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json().get("documents", [])

    async def create_order(self, product_id: str, quantity: int) -> dict:
        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            response = await client.post(
                f"{self.base_url}/api/v1/regions/{self.region_id}/orders",
                json={"product_id": product_id, "quantity": quantity},
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()
