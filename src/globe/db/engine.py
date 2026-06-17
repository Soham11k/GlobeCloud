from __future__ import annotations

from contextlib import contextmanager
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
        _platform_engine = _make_engine(settings.database_url)
        _PlatformSession = sessionmaker(bind=_platform_engine, autoflush=False, autocommit=False)
    return _platform_engine


def get_regional_engine() -> Engine:
    global _regional_engine, _RegionalSession
    settings = get_settings()
    if _regional_engine is None:
        url = settings.regional_db_url
        _regional_engine = _make_engine(url)
        _RegionalSession = sessionmaker(bind=_regional_engine, autoflush=False, autocommit=False)
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


def init_db() -> None:
    """Create tables and extensions (dev/bootstrap). Prefer Alembic in production."""
    from globe.db import platform_models  # noqa: F401
    from globe.db import regional_models  # noqa: F401

    settings = get_settings()
    platform_engine = get_platform_engine()
    regional_engine = get_regional_engine()
    if not settings.uses_sqlite:
        engine = regional_engine if regional_engine.url != platform_engine.url else platform_engine
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
    PlatformBase.metadata.create_all(bind=platform_engine)
    RegionalBase.metadata.create_all(bind=regional_engine)

