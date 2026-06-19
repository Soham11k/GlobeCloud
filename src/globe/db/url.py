from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse


def normalize_database_url(url: str) -> str:
    """Normalize Postgres URLs for SQLAlchemy + psycopg (incl. Supabase)."""
    raw = url.strip()
    if not raw:
        return raw

    if raw.startswith("postgres://"):
        raw = "postgresql+psycopg://" + raw[len("postgres://") :]
    elif raw.startswith("postgresql://") and "+psycopg" not in raw.split("://", 1)[0]:
        raw = "postgresql+psycopg://" + raw[len("postgresql://") :]

    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower()
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))

    if _requires_ssl(host) and query.get("sslmode", "").lower() not in ("require", "verify-full", "verify-ca"):
        query["sslmode"] = "require"

    if query:
        raw = urlunparse(parsed._replace(query=urlencode(query)))
    return raw


def _requires_ssl(host: str) -> bool:
    if not host:
        return False
    return host.endswith(".supabase.co") or host.endswith(".supabase.com") or "pooler.supabase.com" in host
