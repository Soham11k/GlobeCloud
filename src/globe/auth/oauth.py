from __future__ import annotations

import secrets
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, Request
from itsdangerous import BadSignature, BadTimeSignature, URLSafeTimedSerializer

from globe.config import get_settings

_OAUTH_STATE_MAX_AGE = 600


def _state_serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().jwt_secret_key, salt="globe-oauth-state")


def create_oauth_state(provider: str, invite: Optional[str] = None) -> str:
    payload: dict[str, str] = {
        "p": provider,
        "n": secrets.token_urlsafe(16),
    }
    if invite:
        payload["i"] = invite[:512]
    return _state_serializer().dumps(payload)


def parse_oauth_state(state: Optional[str], provider: str) -> dict[str, str]:
    if not state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    try:
        data = _state_serializer().loads(state, max_age=_OAUTH_STATE_MAX_AGE)
    except (BadSignature, BadTimeSignature) as exc:
        raise HTTPException(status_code=400, detail="Invalid OAuth state") from exc
    if not isinstance(data, dict) or data.get("p") != provider:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    return data


def google_authorize_url(request: Request, invite: Optional[str] = None) -> str:
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")
    state = create_oauth_state("google", invite=invite)
    redirect_uri = f"{settings.oauth_redirect_base_url.rstrip('/')}/auth/oauth/callback/google"
    params = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "select_account",
        }
    )
    return f"https://accounts.google.com/o/oauth2/v2/auth?{params}"


def github_authorize_url(request: Request, invite: Optional[str] = None) -> str:
    settings = get_settings()
    if not settings.github_client_id:
        raise HTTPException(status_code=503, detail="GitHub OAuth not configured")
    state = create_oauth_state("github", invite=invite)
    redirect_uri = f"{settings.oauth_redirect_base_url.rstrip('/')}/auth/oauth/callback/github"
    params = urlencode(
        {
            "client_id": settings.github_client_id,
            "redirect_uri": redirect_uri,
            "scope": "user:email",
            "state": state,
        }
    )
    return f"https://github.com/login/oauth/authorize?{params}"


async def exchange_google_code(request: Request, code: str) -> tuple[str, str, str]:
    settings = get_settings()
    redirect_uri = f"{settings.oauth_redirect_base_url.rstrip('/')}/auth/oauth/callback/google"
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code >= 400:
            raise HTTPException(status_code=400, detail="Google token exchange failed")
        token = token_resp.json()
        user_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {token['access_token']}"},
        )
        user_resp.raise_for_status()
        profile = user_resp.json()
    return (
        str(profile.get("sub", "")),
        profile.get("email", ""),
        profile.get("name", ""),
    )


async def exchange_github_code(request: Request, code: str) -> tuple[str, str, str]:
    settings = get_settings()
    redirect_uri = f"{settings.oauth_redirect_base_url.rstrip('/')}/auth/oauth/callback/github"
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )
        if token_resp.status_code >= 400:
            raise HTTPException(status_code=400, detail="GitHub token exchange failed")
        token = token_resp.json()
        access = token.get("access_token")
        if not access:
            raise HTTPException(status_code=400, detail="GitHub token missing")
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access}"},
        )
        user_resp.raise_for_status()
        profile = user_resp.json()
        email = profile.get("email") or ""
        if not email:
            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access}"},
            )
            if emails_resp.status_code == 200:
                emails = emails_resp.json()
                primary = next((e for e in emails if e.get("primary")), None)
                if primary:
                    email = primary.get("email", "")
    provider_user_id = str(profile.get("id", ""))
    name = profile.get("name") or profile.get("login", "")
    return provider_user_id, email, name
