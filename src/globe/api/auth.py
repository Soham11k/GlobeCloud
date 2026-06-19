from typing import Optional

from fastapi import HTTPException, Request, Security
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer

from globe.auth.tokens import decode_access_token
from globe.config import get_settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
replication_header = APIKeyHeader(name="X-Replication-Secret", auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)

_PUBLIC_SUFFIXES = (
    "/health",
    "/product",
    "/regions",
    "/route",
    "/catalog",
    "/sync/status",
    "/activity",
    "/metrics",
    "/stream/metrics",
)

_WRITE_ROLES = frozenset({"owner", "admin", "member"})


async def get_current_user(request: Request) -> Optional[dict]:
    auth: Optional[HTTPAuthorizationCredentials] = await bearer_scheme(request)
    if auth and auth.credentials:
        payload = decode_access_token(auth.credentials)
        if payload and payload.get("sub"):
            return {
                "id": payload["sub"],
                "email": payload.get("email", ""),
                "org_id": payload.get("org_id", ""),
                "role": payload.get("role", "member"),
            }
    return None


_PUBLIC_ALWAYS = ("/health",)


def _is_public_get(path: str, method: str) -> bool:
    if method != "GET":
        return False
    if not path.startswith("/api/v1"):
        return False
    normalized = path.rstrip("/")
    return any(normalized.endswith(suffix) for suffix in _PUBLIC_SUFFIXES)


def _is_ops_health_check(path: str, method: str) -> bool:
    if method != "GET" or not path.startswith("/api/v1"):
        return False
    normalized = path.rstrip("/")
    return any(normalized.endswith(suffix) for suffix in _PUBLIC_ALWAYS)


async def require_authenticated(request: Request) -> None:
    user = await get_current_user(request)
    if user:
        request.state.user_id = user["id"]
        request.state.user_email = user.get("email", "")
        request.state.org_id = user.get("org_id", "")
        request.state.org_role = user.get("role", "member")
        return

    settings = get_settings()
    key = request.headers.get("X-API-Key")
    if key:
        store = getattr(request.app.state, "auth_store", None)
        if store and hasattr(store, "validate_api_key"):
            info = store.validate_api_key(key)
            if info:
                request.state.org_id = info["org_id"]
                request.state.api_key_id = info["key_id"]
                return
        if settings.api_auth_enabled and key in settings.valid_api_keys:
            return

    raise HTTPException(status_code=401, detail="Authentication required")


async def require_api_access(
    request: Request,
    key: Optional[str] = Security(api_key_header),
) -> None:
    """Production: all /api/v1/* require auth. Dev allows public GET on health/catalog."""
    path = request.url.path
    if path.startswith("/auth") or not path.startswith("/api/v1"):
        return
    if path.startswith("/api/v1/billing/webhook"):
        return

    settings = get_settings()
    if settings.globe_public_read and _is_public_get(path, request.method):
        return
    if _is_ops_health_check(path, request.method):
        return
    if not settings.is_production and _is_public_get(path, request.method):
        return

    await require_authenticated(request)

    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        role = getattr(request.state, "org_role", None)
        if role and role not in _WRITE_ROLES:
            raise HTTPException(status_code=403, detail="Insufficient permissions")


async def require_replication_secret(
    secret: Optional[str] = Security(replication_header),
) -> None:
    settings = get_settings()
    if settings.is_production and not settings.replication_auth_enabled:
        raise HTTPException(status_code=500, detail="REPLICATION_SECRET required")
    if not settings.replication_auth_enabled:
        return
    if secret != settings.replication_secret:
        raise HTTPException(status_code=401, detail="Invalid or missing replication secret")
