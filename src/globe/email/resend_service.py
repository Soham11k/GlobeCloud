from __future__ import annotations

import logging

import httpx

from globe.config import get_settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, html: str) -> bool:
    settings = get_settings()
    if not settings.email_enabled:
        logger.info("Email (dev): to=%s subject=%s", to, subject)
        return True
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.email_from,
                "to": [to],
                "subject": subject,
                "html": html,
            },
        )
        if response.status_code >= 400:
            logger.error("Resend error: %s", response.text)
            return False
        return True


def verification_email_html(link: str) -> str:
    return f"""
    <h2>Verify your GlobeCloud email</h2>
    <p><a href="{link}">Click here to verify</a></p>
  """


def password_reset_html(link: str) -> str:
    return f"""
    <h2>Reset your GlobeCloud password</h2>
    <p><a href="{link}">Click here to reset</a></p>
  """


def invite_email_html(org_name: str, link: str) -> str:
    return f"""
    <h2>You've been invited to {org_name}</h2>
    <p><a href="{link}">Accept invitation</a></p>
  """
