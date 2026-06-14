# GlobeCloud

**GlobeCloud** is a global database product — one URL worldwide, three regional backends, geo-routed API, and a RAG-grounded AI copilot.

| Surface | URL (after deploy) |
|---------|------------------|
| **Global console** | `https://globecloud.fly.dev/app` |
| **Landing page** | `https://globecloud.fly.dev` |
| **Fleet status API** | `/api/v1/global/status` |

## Quick start — share a demo (no credit card)

```bash
./scripts/setup.sh
./scripts/share-demo.sh
```

Copy the `trycloudflare.com` URL and send customers to **`/app`**. They can follow the Getting Started checklist in the console.

Full guide: [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)

## Local development

```bash
./scripts/setup.sh
./scripts/start-clean.sh
```

Or for a **full clean rebuild** (wipes venv + database, reinstalls, smoke tests):

```bash
./scripts/rebuild.sh
```

Open [http://127.0.0.1:8000/app](http://127.0.0.1:8000/app)

**Frontend dev** (hot reload, proxies API to :8000):

```bash
./scripts/start-clean.sh   # terminal 1
cd frontend && npm run dev # terminal 2 → http://127.0.0.1:5173
```

Status page: [http://127.0.0.1:8000/status](http://127.0.0.1:8000/status)

## Share publicly (Cloudflare Tunnel)

```bash
./scripts/share-demo.sh
```

See [docs/TUNNEL.md](docs/TUNNEL.md) for tunnel-specific details.

## Publish to GitHub

Keep [github.com/Soham11k/GlobeCloud](https://github.com/Soham11k/GlobeCloud) in sync after changes:

```bash
./scripts/publish-github.sh
# or with a custom message:
./scripts/publish-github.sh "Add routing panel polish"
```

## Deploy globally (Fly.io — requires card)

```bash
export API_KEY=$(openssl rand -hex 32)
export REPLICATION_SECRET=$(openssl rand -hex 32)
chmod +x scripts/deploy-global-fly.sh
./scripts/deploy-global-fly.sh
```

This creates 4 Fly apps: **globecloud** (gateway) + **globecloud-us/eu/ap** (regional backends).

Full guide: [docs/DEPLOY.md](docs/DEPLOY.md)

## Deployment modes

| Mode | Use case |
|------|----------|
| `local` | Dev — all 3 regions simulated on one machine |
| `regional` | Fly regional backend (US, EU, or AP) |
| `gateway` | Fly global entry point — proxies to regions |

## Architecture

```text
Users → globecloud.fly.dev (gateway)
           ├── globecloud-us.fly.dev
           ├── globecloud-eu.fly.dev
           └── globecloud-ap.fly.dev
```

## Key endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/global/status` | Fleet health (gateway) |
| `GET /api/v1/route` | Geo-route to nearest region |
| `POST /api/v1/agent/ask` | AI copilot (proxied to best region) |
| `GET /api/v1/regions/{id}/products` | Federated regional inventory |

## Project layout

```text
frontend/                        # React + Vite + Tailwind console & landing
src/globe/gateway/proxy.py       # Global gateway proxy
src/globe/api/gateway_routes.py  # Gateway API
deploy/fly/                      # Fly.io configs (gateway + 3 regions)
scripts/setup.sh                 # One-command bootstrap (+ frontend build)
scripts/share-demo.sh            # Public demo via Cloudflare Tunnel
scripts/start-clean.sh           # Clean local restart
scripts/deploy-global-fly.sh     # One-command global deploy
scripts/rotate-api-key.sh        # Rotate API keys on Fly fleet
.github/workflows/deploy.yml     # CI/CD pipeline
docs/GETTING_STARTED.md        # Host + visitor guide
docs/DEPLOY.md                   # Fly.io deployment guide
docs/TUNNEL.md                   # Cloudflare tunnel guide
```
