from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select

from globe.api.auth import get_current_user, require_authenticated
from globe.auth.tokens import create_invite_token, hash_token
from globe.config import get_settings
from globe.db.engine import get_platform_session
from globe.db.platform_models import ApiKey, Organization, OrganizationInvite, OrganizationMember, User
from globe.email.resend_service import invite_email_html, send_email


class CreateApiKeyRequest(BaseModel):
    label: str = Field(default="default", max_length=120)


class InviteRequest(BaseModel):
    email: EmailStr
    role: str = Field(default="member", pattern="^(admin|member|viewer)$")


class UpdateMemberRequest(BaseModel):
    role: str = Field(pattern="^(owner|admin|member|viewer)$")


def build_settings_router() -> APIRouter:
    router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

    @router.get("/api-keys")
    async def list_api_keys(request: Request, _=Depends(require_authenticated)) -> dict:
        user = await get_current_user(request)
        org_id = user.get("org_id") if user else None
        if not org_id:
            raise HTTPException(status_code=400, detail="No organization")
        with get_platform_session() as session:
            rows = session.execute(
                select(
                    ApiKey.id,
                    ApiKey.label,
                    ApiKey.created_at,
                    ApiKey.last_used_at,
                )
                .where(ApiKey.organization_id == org_id)
                .order_by(ApiKey.created_at.desc())
            ).all()
            keys = [
                {
                    "id": row.id,
                    "label": row.label,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                    "last_used_at": row.last_used_at.isoformat() if row.last_used_at else None,
                }
                for row in rows
            ]
        return {"keys": keys}

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
            session.flush()
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

    @router.get("/members")
    async def list_members(request: Request, _=Depends(require_authenticated)) -> dict:
        user = await get_current_user(request)
        org_id = user.get("org_id") if user else None
        if not org_id:
            raise HTTPException(status_code=400, detail="No organization")
        with get_platform_session() as session:
            rows = session.execute(
                select(
                    OrganizationMember.id,
                    OrganizationMember.user_id,
                    OrganizationMember.role,
                    User.email,
                    User.name,
                )
                .join(User, User.id == OrganizationMember.user_id)
                .where(OrganizationMember.organization_id == org_id)
                .order_by(OrganizationMember.role)
            ).all()
            invite_rows = session.execute(
                select(
                    OrganizationInvite.id,
                    OrganizationInvite.email,
                    OrganizationInvite.role,
                    OrganizationInvite.created_at,
                    OrganizationInvite.expires_at,
                )
                .where(
                    OrganizationInvite.organization_id == org_id,
                    OrganizationInvite.expires_at > datetime.now(timezone.utc),
                )
                .order_by(OrganizationInvite.created_at.desc())
            ).all()
            members = [
                {
                    "id": row.id,
                    "user_id": row.user_id,
                    "email": row.email,
                    "name": row.name or "",
                    "role": row.role,
                    "joined_at": None,
                }
                for row in rows
            ]
            invites = [
                {
                    "id": row.id,
                    "email": row.email,
                    "role": row.role,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                    "expires_at": row.expires_at.isoformat() if row.expires_at else None,
                }
                for row in invite_rows
            ]
        return {"members": members, "invites": invites}

    @router.post("/invites")
    async def create_invite(
        body: InviteRequest, request: Request, _=Depends(require_authenticated)
    ) -> dict:
        user = await get_current_user(request)
        org_id = user.get("org_id") if user else None
        role = user.get("role") if user else None
        if not org_id:
            raise HTTPException(status_code=400, detail="No organization")
        if role not in ("owner", "admin"):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        settings = get_settings()
        email = body.email.strip().lower()
        token = create_invite_token(org_id, email, body.role)
        expires = datetime.now(timezone.utc) + timedelta(days=7)
        org_name = "GlobeCloud"
        with get_platform_session() as session:
            org = session.get(Organization, org_id)
            if org:
                org_name = org.name
            existing = session.scalar(select(User).where(User.email == email))
            if existing:
                member = session.scalar(
                    select(OrganizationMember).where(
                        OrganizationMember.organization_id == org_id,
                        OrganizationMember.user_id == existing.id,
                    )
                )
                if member:
                    raise HTTPException(status_code=400, detail="User is already a member")
            invite = OrganizationInvite(
                id=str(uuid.uuid4()),
                organization_id=org_id,
                email=email,
                role=body.role,
                token_hash=hash_token(token),
                invited_by=user.get("id"),
                expires_at=expires,
            )
            session.add(invite)
        if settings.email_enabled:
            base = settings.oauth_redirect_base_url.rstrip("/")
            link = f"{base}/signup?invite={token}"
            await send_email(email, f"Join {org_name}", invite_email_html(org_name, link))
            return {"ok": True, "message": "Invite sent via email"}
        return {"ok": True, "message": "Invite created (email not configured — share signup link manually)"}

    @router.patch("/members/{member_id}")
    async def update_member(
        member_id: str, body: UpdateMemberRequest, request: Request, _=Depends(require_authenticated)
    ) -> dict:
        user = await get_current_user(request)
        org_id = user.get("org_id") if user else None
        role = user.get("role") if user else None
        if role not in ("owner", "admin"):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        if body.role == "owner" and role != "owner":
            raise HTTPException(status_code=403, detail="Only owners can assign owner role")
        with get_platform_session() as session:
            member = session.get(OrganizationMember, member_id)
            if not member or member.organization_id != org_id:
                raise HTTPException(status_code=404, detail="Member not found")
            member.role = body.role
        return {"ok": True}

    @router.delete("/members/{member_id}")
    async def remove_member(
        member_id: str, request: Request, _=Depends(require_authenticated)
    ) -> dict:
        user = await get_current_user(request)
        org_id = user.get("org_id") if user else None
        role = user.get("role") if user else None
        if role not in ("owner", "admin"):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        with get_platform_session() as session:
            member = session.get(OrganizationMember, member_id)
            if not member or member.organization_id != org_id:
                raise HTTPException(status_code=404, detail="Member not found")
            if member.role == "owner":
                owners = session.scalars(
                    select(OrganizationMember).where(
                        OrganizationMember.organization_id == org_id,
                        OrganizationMember.role == "owner",
                    )
                ).all()
                if len(owners) <= 1:
                    raise HTTPException(status_code=400, detail="Cannot remove the only owner")
            session.delete(member)
        return {"ok": True}

    return router
