# GlobeCloud Product Catalog

Plan matrix aligned with `seed/catalog.json`. Use this for sales consistency and documentation.

## Plans

| SKU | Name | Price | Regions | Replication | Copilot |
|-----|------|-------|---------|-------------|---------|
| GC-STARTER | Starter | $49/mo | 3 | 30s | Optional (local fallback) |
| GC-PRO | Pro | $199/mo | 3 | 15s priority | OpenAI with citations |
| GC-ENTERPRISE | Enterprise | Custom | Custom | Configurable | Full + audit logs |

### Starter ($49/mo)

Three regional nodes, geo routing, replication every 30s, and grounded copilot for teams up to 10.

- 120 API requests/minute
- Community support (24h target)
- Metrics snapshot (no history)

### Pro ($199/mo)

Priority replication, HTTP health probes, metrics history, and OpenAI copilot with citation tracking.

- 600 API requests/minute
- Email support (8h response)
- Metrics history + SSE stream

### Enterprise (Custom)

Global gateway, custom SLAs, audit logs, multi-key API access, and dedicated onboarding.

- Custom rate limits
- 15-minute support SLA
- Dedicated gateway included

## Add-ons

| SKU | Name | Price | Description |
|-----|------|-------|-------------|
| GC-ADDON-REGION | Extra region | $29/mo | Fourth regional SQLite node with full replication |
| GC-ADDON-GW | Dedicated gateway | $99/mo | Single-tenant gateway with custom domain |
| GC-ADDON-SUPPORT | Priority support | $149/mo | 15-minute SLA, Slack channel, quarterly reviews |

## Knowledge base

Twelve docs ship with the catalog for copilot grounding:

1. Getting started
2. API authentication
3. Replication model
4. Geo routing
5. Copilot grounding
6. Support SLAs
7. Billing and plans
8. Security practices
9. Data residency
10. Rate limits and quotas
11. Changelog March 2026
12. FAQ

## Seeding

```bash
./scripts/seed-production.sh
./scripts/start-clean.sh
```

Default `.env` uses `SEED_DEMO_DATA=0` and `CATALOG_SEED_FILE=seed/catalog.json` so fresh installs load this catalog only — no demo/parody SKUs.
