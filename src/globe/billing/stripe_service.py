from __future__ import annotations

import logging
from typing import Optional

from globe.config import get_settings

logger = logging.getLogger(__name__)


class StripeService:
    def __init__(self) -> None:
        settings = get_settings()
        self._enabled = settings.stripe_enabled
        self._client = None
        if self._enabled:
            import stripe

            stripe.api_key = settings.stripe_secret_key
            self._client = stripe

    @property
    def enabled(self) -> bool:
        return self._enabled

    def create_checkout_session(
        self,
        *,
        customer_email: str,
        price_id: str,
        org_id: str,
        success_url: str,
        cancel_url: str,
    ) -> Optional[str]:
        if not self._enabled or not self._client:
            return None
        session = self._client.checkout.Session.create(
            mode="subscription",
            customer_email=customer_email,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"org_id": org_id},
        )
        return session.url

    def create_portal_session(self, customer_id: str, return_url: str) -> Optional[str]:
        if not self._enabled or not self._client:
            return None
        session = self._client.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
        return session.url

    def construct_event(self, payload: bytes, sig_header: str):
        settings = get_settings()
        if not self._enabled or not self._client:
            return None
        return self._client.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
