from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response

from globe.ai.agent import DatabaseAgent
from globe.ai.rag import InferenceClient, RAGIndex
from globe.api.gateway_routes import build_gateway_peers, build_gateway_router
from globe.api.middleware import LoggingMiddleware, RateLimitMiddleware
from globe.api.routes import build_api_router
from globe.config import get_settings
from globe.database.models import DatabaseCluster
from globe.database.sync import ReplicationEngine
from globe.gateway.proxy import GatewayProxy
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


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.product_name,
        description=settings.product_tagline,
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(RateLimitMiddleware)

    if settings.is_gateway:
        peers = build_gateway_peers()
        proxy = GatewayProxy(peers, api_key=settings.api_key)
        router = GeoRouter(
            deployment_mode="gateway",
            local_region_id="",
            peer_clients=peers,
        )
        api = build_gateway_router(proxy, router)
        app.include_router(api)
        _mount_static(app)
        return app

    data_dir = Path(settings.data_dir)
    cluster = DatabaseCluster(
        data_dir,
        deployment_mode=settings.deployment_mode,
        region_id=settings.region_id,
        peer_urls=settings.peers,
        api_key=settings.api_key,
        replication_secret=settings.replication_secret,
        seed_demo_data=settings.seed_demo_data,
        catalog_seed_file=settings.catalog_seed_file,
    )
    router = GeoRouter(
        deployment_mode=settings.deployment_mode,
        local_region_id=settings.region_id,
        peer_clients=cluster.peers,
    )
    replicator = ReplicationEngine(cluster)
    rag = RAGIndex()

    def _rebuild_rag() -> None:
        if settings.is_regional:
            return
        rag.rebuild(cluster.all_knowledge_sync())

    replicator.on_sync = _rebuild_rag
    llm = InferenceClient()
    agent = DatabaseAgent(cluster, router, replicator, rag, llm)

    api, repl = build_api_router(cluster, router, replicator, rag, llm, agent)
    app.include_router(api)
    app.include_router(repl)

    @app.on_event("startup")
    async def startup() -> None:
        if settings.is_regional:
            rag.rebuild(await cluster.all_knowledge())
        else:
            rag.rebuild(cluster.all_knowledge_sync())
        await replicator.start()

    @app.on_event("shutdown")
    async def shutdown() -> None:
        await replicator.stop()

    _mount_static(app)
    return app


app = create_app()
