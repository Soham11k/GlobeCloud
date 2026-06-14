# Getting Started with GlobeCloud

One guide for **hosts** (you) and **visitors** (your customers). Primary path: share a free public demo via Cloudflare Tunnel.

---

## For hosts — share a demo in 2 commands

### 1. One-time setup

From the project root:

```bash
chmod +x scripts/setup.sh scripts/share-demo.sh scripts/start-clean.sh scripts/smoke-test.sh
./scripts/setup.sh
```

This creates a virtual environment, installs GlobeCloud, and copies `.env.example` → `.env` if needed.

### 2. Start a public demo

```bash
./scripts/share-demo.sh
```

When Cloudflare prints a URL like `https://random-words.trycloudflare.com`, share these links:

| Link | URL |
|------|-----|
| **Console** (send this to customers) | `https://YOUR-URL.trycloudflare.com/app` |
| Landing page | `https://YOUR-URL.trycloudflare.com/` |

**Tell your customer:**

> Open the Console link → follow the **Getting started** checklist, or click **Run demo flow** for a quick tour. Leave the API key blank.

### 3. Verify before sharing (optional)

```bash
./scripts/smoke-test.sh
```

### Optional: protect the demo with an API key

```bash
export API_KEY=$(openssl rand -hex 32)
echo "Share this key with visitors: $API_KEY"
./scripts/share-demo.sh
```

Visitors paste the key in the console sidebar (Settings on mobile).

### Local development (no tunnel)

```bash
./scripts/start-clean.sh
```

Open http://127.0.0.1:8000/app

---

## For visitors — using the console

1. Open the `/app` link your host sent you.
2. On first visit, read the welcome message and dismiss it.
3. On **Overview**, follow the **Getting started** checklist:
   - **Server connected** — auto-completes when the API is reachable
   - **Run a route** — go to **Routing** and click NYC, London, or **Route request**
   - **Place an order** — go to **Inventory** and click **Order** on any product
   - **Ask the copilot** — go to **Copilot** and try a suggested prompt
4. Or click **Run demo flow** on Overview for an automated walkthrough.

### Panels at a glance

| Panel | What to try |
|-------|-------------|
| **Overview** | Region health, latency chart, sync stats |
| **Routing** | City presets, world map, latency comparison |
| **Inventory** | Browse products per region, place orders |
| **Replication** | Sync topology, force sync |
| **Copilot** | Ask about routing, replication, inventory |

### API key

- **Leave blank** unless your host gave you a key.
- If you see **401** errors, open Settings → **Clear key** → refresh.

### Help

- In-console footer: **API Docs**, **Help**
- On-console help page: `/help`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Demo offline / cannot connect | Ask host to run `./scripts/share-demo.sh` and keep their machine awake |
| Console buttons do nothing | Refresh; clear API key in Settings |
| 401 / invalid API key | Clear key in sidebar, refresh |
| Slow or hanging requests | Host runs `./scripts/start-clean.sh` to kill port 8001 zombies |
| Tunnel connection refused | Host restarts GlobeCloud, then restarts tunnel |
| Slow first load via tunnel | Wait 10–20 seconds after URL appears |

More tunnel details: [TUNNEL.md](TUNNEL.md)

---

## Production upgrade (Fly.io)

For always-on hosting with a global gateway and custom domain, see [DEPLOY.md](DEPLOY.md).

```bash
export API_KEY=$(openssl rand -hex 32)
export REPLICATION_SECRET=$(openssl rand -hex 32)
./scripts/deploy-global-fly.sh
```

---

## CLI demo (developers)

```bash
source .venv/bin/activate
globe-cli demo
globe-cli demo --base-url https://YOUR-URL.trycloudflare.com
```
