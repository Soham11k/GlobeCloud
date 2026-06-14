from __future__ import annotations

import logging

import uvicorn

from globe.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
)


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "globe.api.app:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )


if __name__ == "__main__":
    main()
