from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from globe.api.auth import require_api_access
from globe.api.routes import AgentRequest, KnowledgeRequest, OrderRequest, ProductImportRequest, ProductRequest
from globe.config import get_settings
from globe.database.models import REGIONS
from globe.database.peer import PeerClient
from globe.gateway.proxy import GatewayProxy, format_proxy_error
from globe.routing.geo_router import GeoRouter


def build_gateway_peers() -> dict:
    settings = get_settings()
    return {
        region_id: PeerClient(region_id, url, api_key=settings.api_key)
        for region_id, url in settings.gateway_peer_map.items()
    }


def build_gateway_router(proxy: GatewayProxy, router: GeoRouter) -> APIRouter:
    settings = get_settings()
    api = APIRouter(prefix="/api/v1", dependencies=[Depends(require_api_access)])

    @api.get("/product")
    async def product_info() -> dict:
        return {
            "name": settings.product_name,
            "tagline": settings.product_tagline,
            "version": "1.0.0",
            "deployment_mode": "gateway",
            "local_region": None,
            "public_url": settings.public_url or None,
            "features": [
                "geo_routing",
                "multi_region_replication",
                "rag_agent",
                "global_gateway",
            ],
            "regions": len(proxy.peers),
            "peers": list(proxy.peers.keys()),
            "auth_required": settings.auth_enabled,
            "user_auth_required": settings.user_auth_required,
            "guest_read_enabled": settings.guest_read_enabled,
            "oauth_providers": settings.oauth_providers,
            "llm_mode": "openai" if settings.llm_enabled else "mock",
        }

    @api.get("/health")
    async def health() -> dict:
        fleet = await proxy.aggregate_global_status()
        return {
            "status": "ok" if fleet["healthy_regions"] > 0 else "degraded",
            "product": settings.product_name,
            "deployment_mode": "gateway",
            "region": None,
            "healthy_regions": fleet["healthy_regions"],
            "llm_mode": "openai" if settings.llm_enabled else "mock",
            "replication_running": True,
        }

    @api.get("/global/status")
    async def global_status() -> dict:
        return await proxy.aggregate_global_status()

    @api.get("/regions")
    async def list_regions() -> dict:
        return {
            "local_region": None,
            "deployment_mode": "gateway",
            "regions": [
                {
                    "id": r.id,
                    "name": r.name,
                    "latitude": r.latitude,
                    "longitude": r.longitude,
                    "base_latency_ms": r.base_latency_ms,
                    "is_local": False,
                    "peer_url": settings.gateway_peer_map.get(r.id),
                }
                for r in REGIONS
            ],
        }

    @api.get("/route")
    async def route_request(
        client_lat: float = Query(40.0, ge=-90, le=90),
        client_lon: float = Query(-74.0, ge=-180, le=180),
        preferred_region: Optional[str] = None,
    ) -> dict:
        region, probes = await router.route(client_lat, client_lon, preferred_region)
        selected_probe = next((p for p in probes if p.region_id == region.id), None)
        return {
            "selected_region": region.id,
            "selected_name": region.name,
            "is_local": False,
            "peer_url": selected_probe.peer_url if selected_probe else None,
            "backend_region": region.id,
            "probes": [
                {
                    "region_id": p.region_id,
                    "healthy": p.healthy,
                    "latency_ms": None if p.latency_ms == float("inf") else round(p.latency_ms, 2),
                    "circuit": p.circuit.value,
                    "error_rate": round(p.error_rate, 2),
                    "is_local": False,
                    "peer_url": p.peer_url,
                }
                for p in probes
            ],
        }

    @api.get("/regions/{region_id}/products")
    async def regional_products(region_id: str) -> dict:
        try:
            return await proxy.proxy_json(
                region_id, "GET", f"/api/v1/regions/{region_id}/products"
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=exc.response.status_code, detail=format_proxy_error(exc)) from exc

    @api.get("/regions/{region_id}/knowledge")
    async def regional_knowledge(region_id: str) -> dict:
        try:
            return await proxy.proxy_json(
                region_id, "GET", f"/api/v1/regions/{region_id}/knowledge"
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=exc.response.status_code, detail=format_proxy_error(exc)) from exc

    @api.post("/regions/{region_id}/orders")
    async def create_order(region_id: str, body: OrderRequest) -> dict:
        try:
            return await proxy.proxy_json(
                region_id,
                "POST",
                f"/api/v1/regions/{region_id}/orders",
                json_body=body.model_dump(),
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=exc.response.status_code, detail=format_proxy_error(exc)) from exc

    @api.post("/regions/{region_id}/knowledge")
    async def add_knowledge(region_id: str, body: KnowledgeRequest) -> dict:
        try:
            return await proxy.proxy_json(
                region_id,
                "POST",
                f"/api/v1/regions/{region_id}/knowledge",
                json_body=body.model_dump(),
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=exc.response.status_code, detail=format_proxy_error(exc)) from exc

    @api.post("/regions/{region_id}/products")
    async def create_product(region_id: str, body: ProductRequest) -> dict:
        try:
            return await proxy.proxy_json(
                region_id,
                "POST",
                f"/api/v1/regions/{region_id}/products",
                json_body=body.model_dump(),
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=exc.response.status_code, detail=format_proxy_error(exc)) from exc

    @api.post("/regions/{region_id}/products/import")
    async def import_products(region_id: str, body: ProductImportRequest) -> dict:
        try:
            return await proxy.proxy_json(
                region_id,
                "POST",
                f"/api/v1/regions/{region_id}/products/import",
                json_body=body.model_dump(),
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=exc.response.status_code, detail=format_proxy_error(exc)) from exc

    @api.get("/knowledge/search")
    async def search_knowledge(
        q: str = Query(min_length=2),
        top_k: int = Query(3, ge=1, le=10),
        region_id: Optional[str] = None,
        client_lat: float = Query(40.0, ge=-90, le=90),
        client_lon: float = Query(-74.0, ge=-180, le=180),
    ) -> dict:
        target = region_id
        if not target:
            region, _ = await router.route(client_lat, client_lon)
            target = region.id
        try:
            return await proxy.proxy_json(
                target,
                "GET",
                "/api/v1/knowledge/search",
                params={"q": q, "top_k": top_k},
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=exc.response.status_code, detail=format_proxy_error(exc)) from exc

    @api.get("/sync/status")
    async def sync_status() -> dict:
        fleet = await proxy.aggregate_global_status()
        return {
            "running": True,
            "mode": "gateway",
            "local_region": None,
            "interval_s": None,
            "cycles": None,
            "last_entries_applied": None,
            "regions": {
                r["region_id"]: {
                    "local": False,
                    "peer_url": r["peer_url"],
                    "stats": r["sync"].get("regions", {}).get(r["region_id"], {}).get("stats")
                    if r.get("sync")
                    else None,
                    "sync_lag": r["sync"].get("regions", {}).get(r["region_id"], {}).get("sync_lag", [])
                    if r.get("sync")
                    else [],
                }
                for r in fleet["regions"]
            },
        }

    @api.post("/sync/run")
    async def sync_run() -> dict:
        results = []
        for region_id in proxy.peers:
            try:
                result = await proxy.proxy_json(region_id, "POST", "/api/v1/sync/run")
                results.append({"region": region_id, **result})
            except httpx.HTTPError as exc:
                results.append({"region": region_id, "error": format_proxy_error(exc)})
        return {"mode": "gateway", "results": results}

    @api.post("/agent/ask")
    async def agent_ask(body: AgentRequest) -> dict:
        region, _ = await router.route(
            body.client_lat,
            body.client_lon,
            body.preferred_region,
        )
        try:
            result = await proxy.proxy_json(
                region.id,
                "POST",
                "/api/v1/agent/ask",
                json_body=body.model_dump(),
            )
            result["routed_via_gateway"] = True
            result["backend_region"] = region.id
            return result
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=exc.response.status_code, detail=format_proxy_error(exc)) from exc

    @api.get("/metrics")
    async def metrics() -> dict:
        return await proxy.aggregate_metrics()

    return api
