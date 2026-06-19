import pytest
from datetime import datetime, timedelta, timezone

from globe.auth.tokens import create_invite_token, hash_token
from globe.config import get_settings
from globe.db.engine import get_platform_session, init_db, reset_engines
from globe.db.platform_models import Organization, OrganizationInvite, OrganizationMember
from globe.db.platform_store import PlatformStore
from sqlalchemy import select


@pytest.fixture
def store(tmp_path, monkeypatch):
    db_path = tmp_path / "platform.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("REGIONAL_DATABASE_URL", f"sqlite:///{tmp_path / 'regional.db'}")
    monkeypatch.setenv("ENVIRONMENT", "development")
    get_settings.cache_clear()
    reset_engines()
    init_db()
    yield PlatformStore()
    reset_engines()
    get_settings.cache_clear()


def test_create_user_gets_own_org(store: PlatformStore):
    user = store.create_user("alice@example.com", "password123", "Alice")
    assert user.org_id
    assert user.org_role == "owner"
    with get_platform_session() as session:
        org = session.get(Organization, user.org_id)
        assert org is not None
        assert org.name == "Alice's workspace"
        members = session.scalars(
            select(OrganizationMember).where(OrganizationMember.organization_id == user.org_id)
        ).all()
        assert len(members) == 1


def test_signups_get_distinct_orgs(store: PlatformStore):
    a = store.create_user("a@example.com", "password123", "A")
    b = store.create_user("b@example.com", "password123", "B")
    assert a.org_id != b.org_id


def test_invite_acceptance_on_signup(store: PlatformStore):
    owner = store.create_user("owner@example.com", "password123", "Owner")
    token = create_invite_token(owner.org_id, "member@example.com", "admin")
    with get_platform_session() as session:
        session.add(
            OrganizationInvite(
                id="inv-1",
                organization_id=owner.org_id,
                email="member@example.com",
                role="admin",
                token_hash=hash_token(token),
                expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            )
        )

    member = store.create_user(
        "member@example.com", "password123", "Member", invite_token=token
    )
    assert member.org_id == owner.org_id
    assert member.org_role == "admin"

    with get_platform_session() as session:
        pending = session.scalars(select(OrganizationInvite)).all()
        assert pending == []


def test_invite_rejects_email_mismatch(store: PlatformStore):
    owner = store.create_user("owner2@example.com", "password123", "Owner")
    token = create_invite_token(owner.org_id, "right@example.com", "member")
    with get_platform_session() as session:
        session.add(
            OrganizationInvite(
                id="inv-2",
                organization_id=owner.org_id,
                email="right@example.com",
                role="member",
                token_hash=hash_token(token),
                expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            )
        )

    with pytest.raises(ValueError, match="email does not match"):
        store.create_user("wrong@example.com", "password123", "Wrong", invite_token=token)
