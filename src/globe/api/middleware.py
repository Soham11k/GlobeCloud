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


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("X-Request-Id", str(uuid.uuid4())[:8])
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        log_entry = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": duration_ms,
        }
        logger.info(json.dumps(log_entry))
        response.headers["X-Request-Id"] = request_id
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limit for public API routes."""

    def __init__(self, app, requests_per_minute: int = 120):
        super().__init__(app)
        self.limit = requests_per_minute
        self.hits: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        settings = get_settings()
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        client = request.client.host if request.client else "unknown"
        now = time.time()
        window = self.hits[client]
        self.hits[client] = [t for t in window if now - t < 60]

        if len(self.hits[client]) >= self.limit:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again shortly."},
            )

        self.hits[client].append(now)
        return await call_next(request)
