from __future__ import annotations

import secrets
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, Request

from globe.config import get_settings


def _state_token() -> str:
    return secrets.token_urlsafe(24)


def google_authorize_url(request: Request) -> str:
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")
    state = _state_token()
    request.session["oauth_state"] = state
    request.session["oauth_provider"] = "google"
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


def github_authorize_url(request: Request) -> str:
    settings = get_settings()
    if not settings.github_client_id:
        raise HTTPException(status_code=503, detail="GitHub OAuth not configured")
    state = _state_token()
    request.session["oauth_state"] = state
    request.session["oauth_provider"] = "github"
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


def _verify_state(request: Request, state: Optional[str]) -> None:
    expected = request.session.pop("oauth_state", None)
    if not expected or not state or expected != state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")


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
