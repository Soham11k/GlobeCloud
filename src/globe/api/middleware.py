from __future__ import annotations

import json
import logging
import time
import uuid
from collections import defaultdict
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from globe.config import get_settings

logger = logging.getLogger("globecloud")

_redis_client = None


def _get_redis():
    global _redis_client
    settings = get_settings()
    if not settings.redis_enabled:
        return None
    if _redis_client is None:
        import redis

        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("X-Request-Id", str(uuid.uuid4())[:8])
        request.state.request_id = request_id
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        log_entry = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": duration_ms,
            "org_id": getattr(request.state, "org_id", None),
            "user_id": getattr(request.state, "user_id", None),
        }
        logger.info(json.dumps(log_entry))
        store = getattr(request.app.state, "observ", None)
        if store and request.url.path.startswith("/api/"):
            store.record_audit(
                request_id,
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
            )
        response.headers["X-Request-Id"] = request_id
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limits via Redis when configured, else in-memory."""

    def __init__(self, app, requests_per_minute: int = 120, login_per_minute: int = 10):
        super().__init__(app)
        self.limit = requests_per_minute
        self.login_limit = login_per_minute
        self.hits: dict[str, list[float]] = defaultdict(list)

    def _client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def _check_limit(self, key: str, limit: int) -> bool:
        r = _get_redis()
        if r:
            count = r.incr(key)
            if count == 1:
                r.expire(key, 60)
            return count <= limit
        now = time.time()
        window = self.hits[key]
        self.hits[key] = [t for t in window if now - t < 60]
        if len(self.hits[key]) >= limit:
            return False
        self.hits[key].append(now)
        return True

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not request.url.path.startswith("/api/") and not request.url.path.startswith("/auth/"):
            return await call_next(request)

        client = self._client_ip(request)
        is_login = request.url.path in ("/auth/login", "/auth/register") and request.method == "POST"
        limit = self.login_limit if is_login else self.limit
        prefix = "login" if is_login else "api"
        key = f"rl:{prefix}:{client}"

        if not await self._check_limit(key, limit):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again shortly."},
            )

        return await call_next(request)
