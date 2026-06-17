from __future__ import annotations

import logging

from globe.config import get_settings

logger = logging.getLogger(__name__)
_initialized = False


def init_sentry() -> None:
    global _initialized
    if _initialized:
        return
    _initialized = True
    settings = get_settings()
    if not settings.sentry_enabled:
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            integrations=[StarletteIntegration(), FastApiIntegration()],
            traces_sample_rate=0.1,
            send_default_pii=False,
        )
    except Exception as exc:
        logger.warning("Sentry init failed: %s", exc)
