from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Generator, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from globe.config import get_settings
from globe.db.base import PlatformBase, RegionalBase

_platform_engine: Optional[Engine] = None
_regional_engine: Optional[Engine] = None
_PlatformSession: Optional[sessionmaker] = None
_RegionalSession: Optional[sessionmaker] = None


def _make_engine(url: str) -> Engine:
    kwargs: dict = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["pool_size"] = 10
        kwargs["max_overflow"] = 20
    return create_engine(url, **kwargs)


def get_platform_engine() -> Engine:
    global _platform_engine, _PlatformSession
    settings = get_settings()
    if _platform_engine is None:
        _platform_engine = _make_engine(settings.platform_database_url)
        _PlatformSession = sessionmaker(
            bind=_platform_engine, autoflush=False, autocommit=False, expire_on_commit=False
        )
    return _platform_engine


def get_regional_engine() -> Engine:
    global _regional_engine, _RegionalSession
    settings = get_settings()
    if _regional_engine is None:
        url = settings.regional_db_url
        _regional_engine = _make_engine(url)
        _RegionalSession = sessionmaker(
            bind=_regional_engine, autoflush=False, autocommit=False, expire_on_commit=False
        )
    return _regional_engine


@contextmanager
def get_platform_session() -> Generator[Session, None, None]:
    get_platform_engine()
    assert _PlatformSession is not None
    session = _PlatformSession()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@contextmanager
def get_regional_session() -> Generator[Session, None, None]:
    get_regional_engine()
    assert _RegionalSession is not None
    session = _RegionalSession()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def reset_engines() -> None:
    """Reset cached engines (tests only)."""
    global _platform_engine, _regional_engine, _PlatformSession, _RegionalSession
    if _platform_engine is not None:
        _platform_engine.dispose()
    if _regional_engine is not None:
        _regional_engine.dispose()
    _platform_engine = None
    _regional_engine = None
    _PlatformSession = None
    _RegionalSession = None


def migrate_db() -> None:
    """Apply Alembic migrations to the platform database."""
    from alembic import command
    from alembic.config import Config

    root = Path(__file__).resolve().parents[3]
    cfg = Config(str(root / "alembic.ini"))
    settings = get_settings()
    cfg.set_main_option("sqlalchemy.url", settings.platform_database_url)
    command.upgrade(cfg, "head")


def init_db() -> None:
    """Create tables and extensions. Production uses Alembic; dev uses create_all."""
    from globe.db import platform_models  # noqa: F401
    from globe.db import regional_models  # noqa: F401

    settings = get_settings()
    platform_engine = get_platform_engine()
    regional_engine = get_regional_engine()
    if not settings.uses_sqlite:
        engine = regional_engine if regional_engine.url != platform_engine.url else platform_engine
        try:
            with engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                conn.commit()
        except Exception:
            import logging

            logging.getLogger("globecloud").warning(
                "pgvector extension unavailable — dev mode uses text embeddings"
            )
    if settings.is_production and not os.environ.get("GLOBE_MIGRATIONS_DONE"):
        migrate_db()
    else:
        PlatformBase.metadata.create_all(bind=platform_engine)
    RegionalBase.metadata.create_all(bind=regional_engine)

