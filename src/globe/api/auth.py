from typing import Optional

from fastapi import HTTPException, Request, Security
from fastapi.security import APIKeyHeader

from globe.config import get_settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
replication_header = APIKeyHeader(name="X-Replication-Secret", auto_error=False)


async def require_api_key(
    request: Request,
    key: Optional[str] = Security(api_key_header),
) -> None:
    if request.url.path.rstrip("/").endswith("/health"):
        return
    settings = get_settings()
    if not settings.auth_enabled:
        return
    if not key or key not in settings.valid_api_keys:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


async def require_replication_secret(
    secret: Optional[str] = Security(replication_header),
) -> None:
    settings = get_settings()
    if not settings.replication_auth_enabled:
        return
    if secret != settings.replication_secret:
        raise HTTPException(status_code=401, detail="Invalid or missing replication secret")
