import pytest

from globe.auth.passwords import hash_password, verify_password
from globe.auth.tokens import create_access_token, decode_access_token
from globe.config import get_settings


def test_password_hash_roundtrip():
    hashed = hash_password("secure-password-123")
    assert verify_password("secure-password-123", hashed)
    assert not verify_password("wrong", hashed)


def test_jwt_access_token():
    token = create_access_token("user-1", "a@b.com", org_id="org-1", role="admin")
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "user-1"
    assert payload["org_id"] == "org-1"
    assert payload["role"] == "admin"


def test_production_requires_jwt_secret(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET", "")
    get_settings.cache_clear()
    settings = get_settings()
    with pytest.raises(RuntimeError):
        _ = settings.jwt_secret_key
    get_settings.cache_clear()


def test_development_uses_default_jwt_secret(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("JWT_SECRET", "")
    get_settings.cache_clear()
    assert "dev" in get_settings().jwt_secret_key.lower()
    get_settings.cache_clear()
