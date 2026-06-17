from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select

from globe.api.auth import get_current_user, require_authenticated
from globe.auth.tokens import hash_token
from globe.db.engine import get_platform_session
from globe.db.platform_models import ApiKey


class CreateApiKeyRequest(BaseModel):
    label: str = Field(default="default", max_length=120)


def build_settings_router() -> APIRouter:
    router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

    @router.get("/api-keys")
    async def list_api_keys(request: Request, _=Depends(require_authenticated)) -> dict:
        user = await get_current_user(request)
        org_id = user.get("org_id") if user else None
        if not org_id:
            raise HTTPException(status_code=400, detail="No organization")
        with get_platform_session() as session:
            keys = session.scalars(
                select(ApiKey).where(ApiKey.organization_id == org_id).order_by(ApiKey.created_at.desc())
            ).all()
        return {
            "keys": [
                {
                    "id": k.id,
                    "label": k.label,
                    "created_at": k.created_at.isoformat() if k.created_at else None,
                    "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
                }
                for k in keys
            ]
        }

    @router.post("/api-keys")
    async def create_api_key(
        body: CreateApiKeyRequest, request: Request, _=Depends(require_authenticated)
    ) -> dict:
        user = await get_current_user(request)
        org_id = user.get("org_id") if user else None
        role = user.get("role") if user else None
        if not org_id:
            raise HTTPException(status_code=400, detail="No organization")
        if role not in ("owner", "admin"):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        raw = f"gc_{secrets.token_urlsafe(32)}"
        with get_platform_session() as session:
            key = ApiKey(
                id=str(uuid.uuid4()),
                organization_id=org_id,
                key_hash=hash_token(raw),
                label=body.label,
                created_at=datetime.now(timezone.utc),
            )
            session.add(key)
        return {"id": key.id, "label": key.label, "key": raw, "message": "Store this key securely"}

    @router.delete("/api-keys/{key_id}")
    async def revoke_api_key(
        key_id: str, request: Request, _=Depends(require_authenticated)
    ) -> dict:
        user = await get_current_user(request)
        org_id = user.get("org_id") if user else None
        role = user.get("role") if user else None
        if role not in ("owner", "admin"):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        with get_platform_session() as session:
            key = session.get(ApiKey, key_id)
            if not key or key.organization_id != org_id:
                raise HTTPException(status_code=404, detail="Key not found")
            session.delete(key)
        return {"ok": True}

    return router
