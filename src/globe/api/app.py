from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response

from starlette.middleware.sessions import SessionMiddleware

from globe.ai.agent import DatabaseAgent
from globe.ai.rag import InferenceClient, RAGIndex
from globe.api.auth_routes import build_auth_router
from globe.api.billing_routes import build_billing_router
from globe.api.settings_routes import build_settings_router
from globe.api.gateway_routes import build_gateway_peers, build_gateway_router
from globe.api.middleware import LoggingMiddleware, RateLimitMiddleware
from globe.api.routes import build_api_router
from globe.config import get_settings
from globe.db import PlatformStore, PostgresCluster, init_db
from globe.database.sync import ReplicationEngine
from globe.gateway.proxy import GatewayProxy
from globe.observability.metrics import setup_prometheus
from globe.observability.sampler import MetricsSampler, observability_path
from globe.observability.sentry import init_sentry
from globe.observability.store import ObservabilityStore
from globe.routing.geo_router import GeoRouter
from globe.routing.geo_router import GeoRouter

STATIC_DIR = Path(__file__).resolve().parents[1] / "static"
DIST_DIR = STATIC_DIR / "dist"
_HTML_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
}


def _spa_index() -> Path:
    if (DIST_DIR / "index.html").is_file():
        return DIST_DIR / "index.html"
    return STATIC_DIR / "index.html"


class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope) -> Response:
        response = await super().get_response(path, scope)
        if path.endswith((".js", ".css", ".html")):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
        return response


def _mount_static(app: FastAPI) -> None:
    if not STATIC_DIR.is_dir():
        return

    assets_dir = DIST_DIR / "assets" if (DIST_DIR / "assets").is_dir() else STATIC_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", NoCacheStaticFiles(directory=assets_dir), name="assets")

    if (DIST_DIR / "favicon.svg").is_file():

        @app.get("/favicon.svg")
        async def favicon() -> FileResponse:
            return FileResponse(DIST_DIR / "favicon.svg")

    @app.get("/")
    async def landing() -> FileResponse:
        return FileResponse(_spa_index(), headers=_HTML_HEADERS)

    @app.get("/status")
    async def status_page() -> FileResponse:
        return FileResponse(_spa_index(), headers=_HTML_HEADERS)

    @app.get("/login")
    @app.get("/signup")
    @app.get("/auth/callback")
    @app.get("/welcome")
    @app.get("/verify-email")
    @app.get("/reset-password")
    async def auth_pages() -> FileResponse:
        return FileResponse(_spa_index(), headers=_HTML_HEADERS)

    @app.get("/app")
    @app.get("/app/{path:path}")
    async def dashboard(path: str = "") -> FileResponse:
        return FileResponse(_spa_index(), headers=_HTML_HEADERS)

    @app.get("/help")
    async def help_page() -> FileResponse:
        help_file = STATIC_DIR / "help.html"
        if help_file.is_file() and not (DIST_DIR / "index.html").is_file():
            return FileResponse(help_file, headers=_HTML_HEADERS)
        return FileResponse(_spa_index(), headers=_HTML_HEADERS)


def _init_auth(app: FastAPI) -> None:
    app.state.auth_store = PlatformStore()
    app.include_router(build_auth_router())
    app.include_router(build_billing_router())
    app.include_router(build_settings_router())


def _bootstrap_databases(app: FastAPI) -> None:
    init_db()
    store = getattr(app.state, "auth_store", None)
    if store is not None:
        store.bootstrap()
    cluster = getattr(app.state, "cluster", None)
    if cluster is not None:
        for db in cluster.regions.values():
            db.bootstrap()


async def _gateway_metrics_loop(router: GeoRouter, observ: ObservabilityStore) -> None:
    """Background sampler on gateway — persists probe latencies for /metrics/history."""
    while True:
        try:
            await router.refresh_probes()
            latencies: list[float] = []
            for probe in router.snapshot():
                ms = probe.latency_ms if probe.latency_ms != float("inf") else 9999.0
                observ.record_metric(
                    "latency_ms",
                    ms,
                    region_id=probe.region_id,
                    labels={"healthy": probe.healthy, "circuit": probe.circuit.value},
                )
                if probe.healthy and probe.latency_ms != float("inf"):
                    latencies.append(probe.latency_ms)
            if latencies:
                observ.record_metric(
                    "latency_ms",
                    sum(latencies) / len(latencies),
                    region_id=None,
                    labels={"aggregate": "fleet_avg"},
                )
        except Exception:
            pass
        await asyncio.sleep(30)


def create_app() -> FastAPI:
    settings = get_settings()
    init_sentry()

    app = FastAPI(
        title=settings.product_name,
        description=settings.product_tagline,
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    cors_origins = settings.cors_origin_list
    if settings.is_production and "*" in cors_origins:
        cors_origins = ["https://globecloud.io"]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(SessionMiddleware, secret_key=settings.jwt_secret_key)
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(RateLimitMiddleware)

    _init_auth(app)
    setup_prometheus(app)

    if settings.is_gateway:
        peers = build_gateway_peers()
        proxy = GatewayProxy(peers, api_key=settings.api_key)
        router = GeoRouter(
            deployment_mode="gateway",
            local_region_id="",
            peer_clients=peers,
        )
        data_dir = Path(settings.data_dir)
        observ = ObservabilityStore(observability_path(data_dir))
        app.state.observ = observ
        api = build_gateway_router(proxy, router, observ)
        app.include_router(api)

        @app.on_event("startup")
        async def gateway_startup() -> None:
            _bootstrap_databases(app)
            app.state._gateway_metrics_task = asyncio.create_task(
                _gateway_metrics_loop(router, observ)
            )

        @app.on_event("shutdown")
        async def gateway_shutdown() -> None:
            task = getattr(app.state, "_gateway_metrics_task", None)
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        _mount_static(app)
        return app

    data_dir = Path(settings.data_dir)
    cluster = PostgresCluster(
        data_dir,
        deployment_mode=settings.deployment_mode,
        region_id=settings.region_id,
        peer_urls=settings.peers,
        api_key=settings.api_key,
        replication_secret=settings.replication_secret,
        seed_demo_data=settings.seed_demo_data,
        catalog_seed_file=settings.catalog_seed_file,
    )
    app.state.cluster = cluster
    router = GeoRouter(
        deployment_mode=settings.deployment_mode,
        local_region_id=settings.region_id,
        peer_clients=cluster.peers,
    )
    replicator = ReplicationEngine(cluster)
    rag = RAGIndex(cluster.local_db() if cluster.regions else None)
    observ = ObservabilityStore(observability_path(data_dir))
    app.state.observ = observ

    def _rebuild_rag() -> None:
        if settings.is_regional and cluster.regions:
            asyncio_run_rag_rebuild(cluster, rag)

    replicator.on_sync = _rebuild_rag
    llm = InferenceClient()
    agent = DatabaseAgent(cluster, router, replicator, rag, llm)
    sampler = MetricsSampler(observ, cluster, router, replicator, llm)

    api, repl = build_api_router(cluster, router, replicator, rag, llm, agent, observ)
    app.include_router(api)
    app.include_router(repl)

    @app.on_event("startup")
    async def startup() -> None:
        _bootstrap_databases(app)
        if cluster.regions:
            if settings.is_regional:
                await rag.rebuild_async(await cluster.all_knowledge())
            else:
                await rag.rebuild_async(cluster.all_knowledge_sync())
        await replicator.start()
        await sampler.start()
        await router.route(40.71, -74.01)

    @app.on_event("shutdown")
    async def shutdown() -> None:
        await sampler.stop()
        await replicator.stop()

    _mount_static(app)
    return app


def asyncio_run_rag_rebuild(cluster, rag) -> None:
    import asyncio

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(rag.rebuild_async(cluster.all_knowledge()))
        else:
            loop.run_until_complete(rag.rebuild_async(cluster.all_knowledge()))
    except RuntimeError:
        pass


app = create_app()
