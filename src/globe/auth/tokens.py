from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import JWTError, jwt

from globe.config import get_settings


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(
    user_id: str,
    email: str,
    *,
    org_id: str = "",
    role: str = "member",
) -> str:
    settings = get_settings()
    expire = _utcnow() + timedelta(minutes=settings.jwt_access_minutes)
    payload = {
        "sub": user_id,
        "email": email,
        "org_id": org_id,
        "role": role,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_user_id() -> str:
    return str(uuid.uuid4())


def create_email_token(user_id: str, purpose: str, hours: int = 24) -> str:
    settings = get_settings()
    expire = _utcnow() + timedelta(hours=hours)
    payload = {"sub": user_id, "purpose": purpose, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


def decode_email_token(token: str, purpose: str) -> Optional[str]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
        if payload.get("purpose") != purpose:
            return None
        return payload.get("sub")
    except JWTError:
        return None


def create_invite_token(org_id: str, email: str, role: str, hours: int = 168) -> str:
    settings = get_settings()
    expire = _utcnow() + timedelta(hours=hours)
    payload = {
        "org_id": org_id,
        "email": email.strip().lower(),
        "role": role,
        "purpose": "invite",
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


def decode_invite_token(token: str) -> Optional[dict[str, Any]]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
        if payload.get("purpose") != "invite":
            return None
        return payload
    except JWTError:
        return None
