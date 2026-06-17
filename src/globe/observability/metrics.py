from __future__ import annotations

import time
from typing import Callable

from fastapi import FastAPI, Request, Response
from starlette.responses import PlainTextResponse

_metrics: dict[str, float] = {}
_histogram: dict[str, list[float]] = {}


def setup_prometheus(app: FastAPI) -> None:
    @app.middleware("http")
    async def prometheus_middleware(request: Request, call_next: Callable) -> Response:
        if request.url.path == "/metrics/prometheus":
            return await call_next(request)
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start
        path = request.url.path.split("?")[0]
        key = f"http_requests_total{{method={request.method},path={path},status={response.status_code}}}"
        _metrics[key] = _metrics.get(key, 0) + 1
        hist_key = f"http_request_duration_seconds{{path={path}}}"
        _histogram.setdefault(hist_key, []).append(duration)
        if len(_histogram[hist_key]) > 1000:
            _histogram[hist_key] = _histogram[hist_key][-500:]
        return response

    @app.get("/metrics/prometheus")
    async def prometheus_metrics() -> PlainTextResponse:
        lines = []
        for key, value in sorted(_metrics.items()):
            name, _, labels = key.partition("{")
            if labels:
                lines.append(f"{name}{{{labels} {value}")
            else:
                lines.append(f"{key} {value}")
        for key, samples in sorted(_histogram.items()):
            if not samples:
                continue
            name = key.split("{")[0]
            avg = sum(samples) / len(samples)
            lines.append(f"{name}_avg {avg:.6f}")
            lines.append(f"{name}_count {len(samples)}")
        return PlainTextResponse("\n".join(lines) + "\n", media_type="text/plain")
