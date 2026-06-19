from typing import List, Optional

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from globe.ai.agent import DatabaseAgent
from globe.ai.rag import InferenceClient, RAGIndex
from globe.api.auth import require_api_access, require_replication_secret
from globe.config import get_settings
from globe.database.models import REGIONS
from globe.database.sync import ReplicationEngine
from globe.observability.store import ObservabilityStore
from globe.routing.geo_router import GeoRouter


class OrderRequest(BaseModel):
    product_id: str
    quantity: int = Field(ge=1, le=100)


class KnowledgeRequest(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    body: str = Field(min_length=10, max_length=4000)


class KnowledgeImportItem(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    body: str = Field(min_length=10, max_length=4000)
    region: Optional[str] = None


class ProductRequest(BaseModel):
    sku: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(gt=0)
    stock: int = Field(ge=0)
    id: Optional[str] = Field(default=None, max_length=64)


class ProductImportRequest(BaseModel):
    products: List[ProductRequest] = Field(min_length=1, max_length=500)
    knowledge: Optional[List[KnowledgeImportItem]] = None


class AgentRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
    client_lat: float = 40.0
    client_lon: float = -74.0
    preferred_region: Optional[str] = None


class ReplicationApplyRequest(BaseModel):
    entries: List[dict]


def _agent_response(result) -> dict:
    return {
        "answer": result.answer,
        "confidence": result.confidence,
        "citations": result.citations,
        "tool_trace": result.tool_trace,
        "inference": result.inference,
    }


async def _rebuild_rag_async(cluster, rag: RAGIndex, settings) -> None:
    if settings.is_regional:
        await rag.rebuild_async(await cluster.all_knowledge())
    else:
        await rag.rebuild_async(cluster.all_knowledge_sync())


def build_api_router(
    cluster,
    router: GeoRouter,
    replicator: ReplicationEngine,
    rag: RAGIndex,
    llm: InferenceClient,
    agent: DatabaseAgent,
    observ: Optional[ObservabilityStore] = None,
) -> APIRouter:
    settings = get_settings()
    api = APIRouter(prefix="/api/v1", dependencies=[Depends(require_api_access)])
    repl = APIRouter(prefix="/api/v1/replication", dependencies=[Depends(require_replication_secret)])

    def _catalog_product_count() -> int:
        sample_region = cluster.local_region_id if settings.is_regional else "us-east-1"
        if cluster.is_local(sample_region):
            return len(cluster.get(sample_region).list_products())
        return len(cluster.local_db().list_products())

    def _knowledge_doc_count() -> int:
        if settings.is_regional:
            return len(cluster.local_db().list_knowledge())
        return sum(len(cluster.get(r).list_knowledge()) for r in cluster.regions)

    @api.get("/product")
    async def product_info() -> dict:
        return {
            "name": settings.product_name,
            "tagline": settings.product_tagline,
            "version": "1.0.0",
            "deployment_mode": settings.deployment_mode,
            "environment": settings.environment,
            "local_region": cluster.local_region_id,
            "public_url": settings.public_url or None,
            "features": [
                "geo_routing",
                "multi_region_replication",
                "rag_agent",
                "org_rbac",
                "stripe_billing",
            ],
            "regions": len(cluster.region_ids()),
            "peers": list(cluster.peers.keys()) if settings.is_regional else [],
            "auth_required": settings.auth_enabled,
            "user_auth_required": settings.user_auth_required,
            "guest_read_enabled": settings.guest_read_enabled,
            "oauth_providers": settings.oauth_providers,
            "oauth_redirect_base_url": settings.oauth_redirect_base_url.rstrip("/"),
            "llm_mode": "openai" if settings.llm_enabled else ("required" if settings.is_production else "dev"),
            "database": "postgresql",
            "catalog_products": _catalog_product_count(),
            "knowledge_docs": _knowledge_doc_count(),
        }

    @api.get("/catalog")
    async def catalog_overview(
        region_id: str = Query("us-east-1"),
    ) -> dict:
        try:
            products = await cluster.get_products(region_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        plans = [p for p in products if p.get("category") == "plans"]
        addons = [p for p in products if p.get("category") == "addons"]
        return {
            "region": region_id,
            "plans": plans,
            "addons": addons,
            "products_total": len(products),
            "knowledge_docs": _knowledge_doc_count(),
        }

    @api.get("/health")
    async def health() -> dict:
        return {
            "status": "ok",
            "product": settings.product_name,
            "deployment_mode": settings.deployment_mode,
            "region": cluster.local_region_id,
            "llm_mode": "openai" if settings.llm_enabled else "mock",
            "replication_running": replicator.status()["running"],
        }

    @api.get("/regions")
    async def list_regions() -> dict:
        return {
            "local_region": cluster.local_region_id,
            "deployment_mode": settings.deployment_mode,
            "regions": [
                {
                    "id": r.id,
                    "name": r.name,
                    "latitude": r.latitude,
                    "longitude": r.longitude,
                    "base_latency_ms": r.base_latency_ms,
                    "is_local": cluster.is_local(r.id),
                    "peer_url": cluster.peer_urls.get(r.id),
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
        if observ:
            observ.record_routing(
                client_lat,
                client_lon,
                region.id,
                [
                    {
                        "region_id": p.region_id,
                        "latency_ms": None if p.latency_ms == float("inf") else round(p.latency_ms, 2),
                        "healthy": p.healthy,
                    }
                    for p in probes
                ],
            )
        return {
            "selected_region": region.id,
            "selected_name": region.name,
            "is_local": selected_probe.is_local if selected_probe else cluster.is_local(region.id),
            "peer_url": selected_probe.peer_url if selected_probe else None,
            "probes": [
                {
                    "region_id": p.region_id,
                    "healthy": p.healthy,
                    "latency_ms": None if p.latency_ms == float("inf") else round(p.latency_ms, 2),
                    "circuit": p.circuit.value,
                    "error_rate": round(p.error_rate, 2),
                    "is_local": p.is_local,
                    "peer_url": p.peer_url,
                    "probe_mode": p.probe_mode,
                }
                for p in probes
            ],
        }

    @api.get("/regions/{region_id}/products")
    async def regional_products(region_id: str) -> dict:
        try:
            products = await cluster.get_products(region_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return {
            "region": region_id,
            "is_local": cluster.is_local(region_id),
            "products": products,
        }

    @api.get("/regions/{region_id}/knowledge")
    async def regional_knowledge(region_id: str) -> dict:
        try:
            documents = await cluster.get_knowledge(region_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return {
            "region": region_id,
            "is_local": cluster.is_local(region_id),
            "documents": documents,
        }

    @api.post("/regions/{region_id}/orders")
    async def create_order(region_id: str, body: OrderRequest) -> dict:
        try:
            order = await cluster.create_order(region_id, body.product_id, body.quantity)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return order

    @api.post("/regions/{region_id}/knowledge")
    async def add_knowledge(region_id: str, body: KnowledgeRequest) -> dict:
        if not cluster.is_local(region_id):
            raise HTTPException(
                status_code=400,
                detail="Knowledge can only be added to the local region on this node",
            )
        try:
            doc = cluster.get(region_id).append_knowledge(body.title, body.body)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        if settings.is_regional:
            await rag.rebuild_async(await cluster.all_knowledge())
        else:
            await rag.rebuild_async(cluster.all_knowledge_sync())
        return doc

    @api.post("/regions/{region_id}/products")
    async def create_product(region_id: str, body: ProductRequest) -> dict:
        if not cluster.is_local(region_id):
            raise HTTPException(
                status_code=400,
                detail="Products can only be created in the local region on this node",
            )
        try:
            product = await cluster.create_product(
                region_id,
                body.sku,
                body.name,
                body.price,
                body.stock,
                product_id=body.id,
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        await _rebuild_rag_async(cluster, rag, settings)
        return product

    @api.post("/regions/{region_id}/products/import")
    async def import_products(region_id: str, body: ProductImportRequest) -> dict:
        if not cluster.is_local(region_id):
            raise HTTPException(
                status_code=400,
                detail="Catalog import only allowed on the local region on this node",
            )
        try:
            result = await cluster.import_catalog(
                region_id,
                [p.model_dump() for p in body.products],
                [k.model_dump() for k in body.knowledge] if body.knowledge else None,
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        await _rebuild_rag_async(cluster, rag, settings)
        return {
            "region": region_id,
            "imported_products": len(result["products"]),
            "imported_knowledge": len(result["knowledge"]),
            **result,
        }

    @api.get("/knowledge/search")
    async def search_knowledge(
        q: str = Query(min_length=2), top_k: int = Query(3, ge=1, le=10)
    ) -> dict:
        chunks = await rag.search(q, top_k=top_k)
        return {
            "query": q,
            "results": [
                {
                    "doc_id": c.doc_id,
                    "title": c.title,
                    "region": c.region,
                    "score": c.score,
                    "body": c.body,
                }
                for c in chunks
            ],
        }

    @api.get("/sync/status")
    async def sync_status() -> dict:
        return replicator.status()

    @api.post("/sync/run")
    async def sync_run() -> dict:
        return await replicator.sync_once()

    @api.post("/agent/ask")
    async def agent_ask(body: AgentRequest) -> dict:
        result = await agent.ask(
            body.question,
            client_lat=body.client_lat,
            client_lon=body.client_lon,
            preferred_region=body.preferred_region,
        )
        return _agent_response(result)

    @api.post("/agent/ask/stream")
    async def agent_ask_stream(body: AgentRequest) -> StreamingResponse:
        region, _health = await router.route(
            body.client_lat, body.client_lon, body.preferred_region
        )
        chunks = await rag.search(body.question, top_k=3, region=region.id)
        system = (
            "You are a cloud infrastructure assistant. "
            "Answer ONLY using the provided context. "
            "If evidence is insufficient, say you are unsure."
        )
        user = (
            f"Question: {body.question}\n\n"
            f"Routed region: {region.name} ({region.id})\n\n"
            f"Retrieved knowledge:\n{rag.as_context(chunks)}"
        )

        async def generate():
            async for token in llm.stream(system, user):
                yield f"data: {json.dumps({'token': token})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")

    @api.get("/metrics")
    async def metrics() -> dict:
        await router.refresh_probes()
        return {
            "deployment_mode": settings.deployment_mode,
            "local_region": cluster.local_region_id,
            "inference_cache": llm.stats(),
            "router": [
                {
                    "region_id": h.region_id,
                    "healthy": h.healthy,
                    "circuit": h.circuit.value,
                    "latency_ms": None
                    if h.latency_ms == float("inf")
                    else round(h.latency_ms, 2),
                    "is_local": h.is_local,
                    "peer_url": h.peer_url,
                    "probe_mode": h.probe_mode,
                }
                for h in router.snapshot()
            ],
        }

    @api.get("/metrics/history")
    async def metrics_history(
        metric: str = Query("latency_ms"),
        region_id: Optional[str] = None,
        since_hours: float = Query(24, ge=1, le=168),
        limit: int = Query(500, ge=1, le=2000),
        fleet_only: bool = Query(False),
    ) -> dict:
        if not observ:
            return {"metric": metric, "points": []}
        points = observ.metrics_history(
            metric, region_id=region_id, since_hours=since_hours, limit=limit
        )
        if fleet_only:
            points = [p for p in points if p.get("region_id") is None]
        return {"metric": metric, "points": points}

    @api.get("/metrics/summary")
    async def metrics_summary(
        metric: str = Query("latency_ms"),
        since_hours: float = Query(24, ge=1, le=168),
    ) -> dict:
        if not observ:
            return {"metric": metric, "summary": {"count": 0}}
        return {"metric": metric, "summary": observ.metrics_summary(metric, since_hours)}

    @api.get("/regions/{region_id}/orders")
    async def regional_orders(
        region_id: str,
        limit: int = Query(50, ge=1, le=200),
        since: str = Query(""),
    ) -> dict:
        try:
            orders = await cluster.list_orders(region_id, limit=limit, since=since)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return {"region": region_id, "orders": orders}

    @api.get("/catalog/search")
    async def catalog_search(
        q: str = Query(""),
        category: str = Query(""),
        region_id: str = Query("us-east-1"),
    ) -> dict:
        try:
            products = await cluster.search_catalog(region_id, q, category)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return {"region": region_id, "query": q, "category": category, "products": products}

    @api.get("/activity")
    async def activity(limit: int = Query(50, ge=1, le=200)) -> dict:
        if not observ:
            return {"items": []}
        return {"items": observ.activity_feed(limit=limit)}

    @api.get("/audit")
    async def audit(
        limit: int = Query(100, ge=1, le=500),
        status: Optional[int] = None,
    ) -> dict:
        if not observ:
            return {"entries": []}
        return {"entries": observ.list_audit(limit=limit, status=status)}

    @api.get("/stream/metrics")
    async def stream_metrics() -> StreamingResponse:
        async def generate():
            while True:
                await router.refresh_probes()
                payload = {
                    "router": [
                        {
                            "region_id": h.region_id,
                            "healthy": h.healthy,
                            "latency_ms": None
                            if h.latency_ms == float("inf")
                            else round(h.latency_ms, 2),
                        }
                        for h in router.snapshot()
                    ],
                    "sync": replicator.status(),
                }
                yield f"data: {json.dumps(payload)}\n\n"
                await asyncio.sleep(3)

        return StreamingResponse(generate(), media_type="text/event-stream")

    @repl.get("/log")
    async def replication_log(since: int = Query(0, ge=0)) -> dict:
        db = cluster.local_db()
        entries = db.replication_entries_since(since)
        return {
            "region": cluster.local_region_id,
            "since": since,
            "entries": entries,
        }

    @repl.post("/apply")
    async def replication_apply(body: ReplicationApplyRequest) -> dict:
        db = cluster.local_db()
        applied = 0
        for entry in body.entries:
            if entry.get("origin_region") == cluster.local_region_id:
                continue
            db.apply_replication_entry(entry)
            applied += 1
        return {"applied": applied, "region": cluster.local_region_id}

    return api, repl
