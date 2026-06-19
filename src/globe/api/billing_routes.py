from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select

from globe.api.auth import get_current_user, require_authenticated
from globe.billing.stripe_service import StripeService
from globe.config import get_settings
from globe.db.engine import get_platform_session
from globe.db.platform_models import Organization, Subscription

stripe_svc = StripeService()


class CheckoutRequest(BaseModel):
    plan: str = "starter"


def build_billing_router() -> APIRouter:
    router = APIRouter(prefix="/api/v1/billing", tags=["billing"])

    @router.post("/checkout")
    async def checkout(body: CheckoutRequest, request: Request, _=Depends(require_authenticated)) -> dict:
        settings = get_settings()
        user = await get_current_user(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        if not stripe_svc.enabled:
            raise HTTPException(status_code=503, detail="Billing not configured")

        price_id = settings.stripe_price_starter
        if body.plan == "pro":
            price_id = settings.stripe_price_pro or price_id
        if not price_id:
            raise HTTPException(status_code=503, detail="Stripe price not configured")

        org_id = user.get("org_id", "")
        base = settings.oauth_redirect_base_url.rstrip("/")
        url = stripe_svc.create_checkout_session(
            customer_email=user.get("email", ""),
            price_id=price_id,
            org_id=org_id,
            success_url=f"{base}/app/settings/billing?success=1",
            cancel_url=f"{base}/app/settings/billing?canceled=1",
        )
        if not url:
            raise HTTPException(status_code=500, detail="Checkout session failed")
        return {"checkout_url": url}

    @router.post("/portal")
    async def portal(request: Request, _=Depends(require_authenticated)) -> dict:
        settings = get_settings()
        user = await get_current_user(request)
        org_id = user.get("org_id") if user else None
        if not org_id:
            raise HTTPException(status_code=400, detail="No organization")
        customer_id = None
        with get_platform_session() as session:
            org = session.get(Organization, org_id)
            if not org or not org.stripe_customer_id:
                raise HTTPException(status_code=400, detail="No Stripe customer")
            customer_id = org.stripe_customer_id
        base = settings.oauth_redirect_base_url.rstrip("/")
        url = stripe_svc.create_portal_session(customer_id, f"{base}/app/settings/billing")
        if not url:
            raise HTTPException(status_code=500, detail="Portal session failed")
        return {"portal_url": url}

    @router.get("/status")
    async def billing_status(request: Request, _=Depends(require_authenticated)) -> dict:
        user = await get_current_user(request)
        org_id = user.get("org_id") if user else None
        if not org_id:
            return {"plan_tier": "none", "status": "inactive", "period_end": None, "stripe_configured": stripe_svc.enabled}
        with get_platform_session() as session:
            org_row = session.execute(
                select(Organization.plan_tier, Organization.stripe_customer_id).where(
                    Organization.id == org_id
                )
            ).one_or_none()
            sub_row = session.execute(
                select(Subscription.status, Subscription.period_end)
                .where(Subscription.organization_id == org_id)
                .order_by(Subscription.period_end.desc())
                .limit(1)
            ).one_or_none()
            plan_tier = org_row.plan_tier if org_row else "starter"
            status_str = sub_row.status if sub_row else "inactive"
            period_end_iso = (
                sub_row.period_end.isoformat() if sub_row and sub_row.period_end else None
            )
            has_stripe_customer = bool(org_row and org_row.stripe_customer_id)
        return {
            "plan_tier": plan_tier,
            "status": status_str,
            "period_end": period_end_iso,
            "stripe_configured": stripe_svc.enabled,
            "has_stripe_customer": has_stripe_customer,
        }

    @router.post("/webhook")
    async def stripe_webhook(request: Request) -> dict:
        payload = await request.body()
        sig = request.headers.get("stripe-signature", "")
        try:
            event = stripe_svc.construct_event(payload, sig)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if event is None:
            return {"ok": True}

        etype = event["type"]
        data = event["data"]["object"]

        if etype == "checkout.session.completed":
            org_id = data.get("metadata", {}).get("org_id")
            customer_id = data.get("customer")
            if org_id and customer_id:
                with get_platform_session() as session:
                    org = session.get(Organization, org_id)
                    if org:
                        org.stripe_customer_id = customer_id
                        org.plan_tier = "starter"

        elif etype in ("customer.subscription.updated", "customer.subscription.deleted"):
            sub_id = data.get("id")
            status = data.get("status", "inactive")
            customer_id = data.get("customer")
            period_end = data.get("current_period_end")
            with get_platform_session() as session:
                org = session.scalar(
                    select(Organization).where(Organization.stripe_customer_id == customer_id)
                )
                if org:
                    org.plan_tier = "pro" if status == "active" and data.get("items") else org.plan_tier
                    existing = session.scalar(
                        select(Subscription).where(Subscription.stripe_subscription_id == sub_id)
                    )
                    pe = (
                        datetime.fromtimestamp(period_end, tz=timezone.utc)
                        if period_end
                        else None
                    )
                    if existing:
                        existing.status = status
                        existing.period_end = pe
                    else:
                        session.add(
                            Subscription(
                                id=str(uuid.uuid4()),
                                organization_id=org.id,
                                stripe_subscription_id=sub_id,
                                status=status,
                                period_end=pe,
                            )
                        )
        return {"ok": True}

    return router
