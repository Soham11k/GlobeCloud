# GlobeCloud Operations Runbook

## Failover

1. Check regional health: `GET /api/v1/health` on each regional app.
2. If a region is down, gateway GeoRouter will exclude it after circuit opens (3 failures).
3. Restore region from latest Fly Postgres snapshot or `scripts/backup-postgres.sh` dump.

## Restore Postgres

```bash
pg_restore -d "$DATABASE_URL" backups/globecloud-us_YYYYMMDD.dump
```

## Replication lag

- Alert when `sync_lag` behind_by > 60 for 5+ minutes.
- Check `GET /api/v1/sync/status` on affected region.
- Verify `REPLICATION_SECRET` matches across peers.
- Run `POST /api/v1/sync/run` to force a cycle.

## Key rotation

1. Generate new `JWT_SECRET`, `REPLICATION_SECRET`, `API_KEY`.
2. `flyctl secrets set` on each app.
3. Redeploy gateway then regional apps.
4. Users re-authenticate; API keys rotated in console.

## Deploy order

1. `alembic upgrade head` on platform DB
2. Regional apps (us, eu, ap)
3. Gateway last

## RPO / RTO

| Asset | RPO | RTO |
|-------|-----|-----|
| Platform Postgres | 24h (Fly snapshots) | 4h |
| Regional Postgres | 24h | 4h |
