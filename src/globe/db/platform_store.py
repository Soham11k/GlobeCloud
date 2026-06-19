from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from globe.auth.passwords import hash_password, verify_password
from globe.auth.tokens import decode_invite_token, hash_token, new_refresh_token, new_user_id
from globe.db.engine import get_platform_session
from globe.db.platform_models import (
    ApiKey,
    AuditEvent,
    OAuthAccount,
    Organization,
    OrganizationInvite,
    OrganizationMember,
    RefreshToken,
    User as UserModel,
)


@dataclass
class User:
    id: str
    email: str
    name: str
    email_verified: bool
    created_at: str
    has_password: bool
    org_id: str = ""
    org_role: str = "member"


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:80]
    return slug or "org"


class PlatformStore:
    """Postgres-backed auth, org, and API key store."""

    def __init__(self) -> None:
        self._bootstrapped = False

    def bootstrap(self) -> None:
        if self._bootstrapped:
            return
        self._ensure_default_org()
        self._bootstrapped = True

    def _ready(self) -> None:
        if not self._bootstrapped:
            self.bootstrap()

    def _ensure_default_org(self) -> None:
        with get_platform_session() as session:
            org = session.scalar(select(Organization).where(Organization.slug == "default"))
            if org is None:
                org = Organization(id=str(uuid.uuid4()), name="Default", slug="default")
                session.add(org)

    def _row_to_user(self, row: UserModel, membership: OrganizationMember | None = None) -> User:
        return User(
            id=row.id,
            email=row.email,
            name=row.name or "",
            email_verified=bool(row.email_verified),
            created_at=row.created_at.isoformat() if row.created_at else "",
            has_password=bool(row.password_hash),
            org_id=membership.organization_id if membership else "",
            org_role=membership.role if membership else "member",
        )

    def _primary_membership(self, session: Session, user_id: str) -> OrganizationMember | None:
        return session.scalar(
            select(OrganizationMember)
            .where(OrganizationMember.user_id == user_id)
            .order_by(OrganizationMember.role)
        )

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        self._ready()
        with get_platform_session() as session:
            row = session.get(UserModel, user_id)
            if not row:
                return None
            membership = self._primary_membership(session, user_id)
            return self._row_to_user(row, membership)

    def get_user_by_email(self, email: str) -> Optional[User]:
        with get_platform_session() as session:
            row = session.scalar(select(UserModel).where(UserModel.email == email.strip().lower()))
            if not row:
                return None
            membership = self._primary_membership(session, row.id)
            return self._row_to_user(row, membership)

    def _unique_org_slug(self, session: Session, base_slug: str) -> str:
        slug = base_slug
        n = 1
        while session.scalar(select(Organization).where(Organization.slug == slug)):
            slug = f"{base_slug}-{n}"
            n += 1
        return slug

    def _org_name_for_user(self, name: str, email: str) -> str:
        label = name.strip() or email.split("@")[0]
        return f"{label}'s workspace"

    def _create_org_for_user(self, session: Session, org_name: str, user_id: str) -> OrganizationMember:
        base_slug = _slugify(org_name)
        slug = self._unique_org_slug(session, base_slug)
        org = Organization(id=str(uuid.uuid4()), name=org_name, slug=slug)
        session.add(org)
        session.flush()
        membership = OrganizationMember(
            id=str(uuid.uuid4()),
            organization_id=org.id,
            user_id=user_id,
            role="owner",
        )
        session.add(membership)
        session.flush()
        return membership

    def _membership_from_invite(
        self, session: Session, invite_token: str, user_id: str, email: str
    ) -> OrganizationMember:
        payload = decode_invite_token(invite_token)
        if not payload:
            raise ValueError("Invalid or expired invite")
        invite_email = (payload.get("email") or "").strip().lower()
        if invite_email != email.strip().lower():
            raise ValueError("Invite email does not match signup email")
        org_id = payload.get("org_id")
        role = payload.get("role") or "member"
        if not org_id:
            raise ValueError("Invalid or expired invite")
        now = datetime.now(timezone.utc)
        invite = session.scalar(
            select(OrganizationInvite).where(
                OrganizationInvite.organization_id == org_id,
                OrganizationInvite.email == invite_email,
                OrganizationInvite.token_hash == hash_token(invite_token),
                OrganizationInvite.expires_at > now,
            )
        )
        if not invite:
            raise ValueError("Invalid or expired invite")
        org = session.get(Organization, org_id)
        if not org:
            raise ValueError("Invalid or expired invite")
        existing = session.scalar(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == user_id,
            )
        )
        if existing:
            raise ValueError("Already a member of this organization")
        membership = OrganizationMember(
            id=str(uuid.uuid4()),
            organization_id=org_id,
            user_id=user_id,
            role=role,
        )
        session.add(membership)
        session.delete(invite)
        session.flush()
        return membership

    def create_user(
        self, email: str, password: str, name: str = "", invite_token: str | None = None
    ) -> User:
        email = email.strip().lower()
        if self.get_user_by_email(email):
            raise ValueError("Email already registered")
        user_id = new_user_id()
        now = datetime.now(timezone.utc)
        with get_platform_session() as session:
            user = UserModel(
                id=user_id,
                email=email,
                password_hash=hash_password(password),
                name=name.strip(),
                email_verified=False,
                created_at=now,
            )
            session.add(user)
            session.flush()
            if invite_token:
                self._membership_from_invite(session, invite_token, user_id, email)
            else:
                org_name = self._org_name_for_user(name, email)
                self._create_org_for_user(session, org_name, user_id)
            membership = self._primary_membership(session, user_id)
            return self._row_to_user(user, membership)

    def authenticate(self, email: str, password: str) -> Optional[User]:
        with get_platform_session() as session:
            row = session.scalar(select(UserModel).where(UserModel.email == email.strip().lower()))
            if not row or not row.password_hash:
                return None
            if not verify_password(password, row.password_hash):
                return None
            membership = self._primary_membership(session, row.id)
            return self._row_to_user(row, membership)

    def issue_refresh_token(self, user_id: str, days: int) -> str:
        token = new_refresh_token()
        token_id = new_user_id()
        expires = datetime.now(timezone.utc) + timedelta(days=days)
        with get_platform_session() as session:
            session.add(
                RefreshToken(
                    id=token_id,
                    user_id=user_id,
                    token_hash=hash_token(token),
                    expires_at=expires,
                )
            )
        return token

    def validate_refresh_token(self, token: str) -> Optional[User]:
        with get_platform_session() as session:
            result = session.execute(
                select(RefreshToken, UserModel)
                .join(UserModel, UserModel.id == RefreshToken.user_id)
                .where(
                    RefreshToken.token_hash == hash_token(token),
                    RefreshToken.revoked_at.is_(None),
                )
            ).first()
            if not result:
                return None
            rt, user = result
            if rt.expires_at < datetime.now(timezone.utc):
                return None
            membership = self._primary_membership(session, user.id)
            return self._row_to_user(user, membership)

    def revoke_refresh_token(self, token: str) -> None:
        now = datetime.now(timezone.utc)
        with get_platform_session() as session:
            rt = session.scalar(
                select(RefreshToken).where(RefreshToken.token_hash == hash_token(token))
            )
            if rt:
                rt.revoked_at = now

    def get_or_create_oauth_user(
        self,
        provider: str,
        provider_user_id: str,
        email: str,
        name: str,
        invite_token: str | None = None,
    ) -> User:
        with get_platform_session() as session:
            oauth = session.scalar(
                select(OAuthAccount).where(
                    OAuthAccount.provider == provider,
                    OAuthAccount.provider_user_id == provider_user_id,
                )
            )
            if oauth:
                user = session.get(UserModel, oauth.user_id)
                if user:
                    membership = self._primary_membership(session, user.id)
                    return self._row_to_user(user, membership)

            email = email.strip().lower()
            user = session.scalar(select(UserModel).where(UserModel.email == email)) if email else None
            if user is None:
                user_id = new_user_id()
                user = UserModel(
                    id=user_id,
                    email=email or f"{provider}_{provider_user_id}@oauth.local",
                    password_hash=None,
                    name=name,
                    email_verified=True,
                    created_at=datetime.now(timezone.utc),
                )
                session.add(user)
                session.flush()
                if invite_token and email:
                    self._membership_from_invite(session, invite_token, user.id, email)
                else:
                    org_name = self._org_name_for_user(name, email or user.email)
                    self._create_org_for_user(session, org_name, user.id)
            session.add(
                OAuthAccount(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    provider=provider,
                    provider_user_id=provider_user_id,
                    email=email,
                    name=name,
                )
            )
            session.flush()
            membership = self._primary_membership(session, user.id)
            return self._row_to_user(user, membership)

    def user_to_dict(self, user: User) -> dict:
        return {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "email_verified": user.email_verified,
            "has_password": user.has_password,
            "org_id": user.org_id,
            "org_role": user.org_role,
        }

    def validate_api_key(self, raw_key: str) -> Optional[dict]:
        with get_platform_session() as session:
            key = session.scalar(select(ApiKey).where(ApiKey.key_hash == hash_token(raw_key)))
            if not key:
                return None
            key.last_used_at = datetime.now(timezone.utc)
            org = session.get(Organization, key.organization_id)
            return {
                "org_id": key.organization_id,
                "org_name": org.name if org else "",
                "key_id": key.id,
                "label": key.label,
            }

    def verify_email(self, user_id: str) -> None:
        with get_platform_session() as session:
            user = session.get(UserModel, user_id)
            if user:
                user.email_verified = True

    def set_password(self, user_id: str, password: str) -> None:
        with get_platform_session() as session:
            user = session.get(UserModel, user_id)
            if not user:
                raise ValueError("User not found")
            user.password_hash = hash_password(password)

    def log_audit(
        self,
        org_id: str,
        action: str,
        *,
        user_id: str | None = None,
        resource: str = "",
        detail: str = "",
    ) -> None:
        with get_platform_session() as session:
            session.add(
                AuditEvent(
                    id=str(uuid.uuid4()),
                    organization_id=org_id,
                    user_id=user_id,
                    action=action,
                    resource=resource,
                    detail=detail,
                )
            )

    def create_organization(self, name: str, owner_user_id: str) -> Organization:
        with get_platform_session() as session:
            base_slug = _slugify(name)
            slug = self._unique_org_slug(session, base_slug)
            org = Organization(id=str(uuid.uuid4()), name=name, slug=slug)
            session.add(org)
            session.flush()
            session.add(
                OrganizationMember(
                    id=str(uuid.uuid4()),
                    organization_id=org.id,
                    user_id=owner_user_id,
                    role="owner",
                )
            )
            return org
