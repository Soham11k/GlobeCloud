# Share GlobeCloud with Cloudflare Tunnel

Get a **free public HTTPS URL** for your local GlobeCloud — no credit card, no Fly.io account.

Cloudflare Tunnel creates a temporary `*.trycloudflare.com` link that forwards to `localhost:8000`.

**Start here:** [GETTING_STARTED.md](GETTING_STARTED.md) — full host + visitor guide.

---

## Quick start

**One-time setup:**

```bash
./scripts/setup.sh
```

**Share a demo:**

```bash
./scripts/share-demo.sh
```

Or use `./scripts/share-tunnel.sh` (same script).

Cloudflare prints a URL like:

```text
https://random-words-here.trycloudflare.com
```

Share that link:

- **Console:** `https://your-url.trycloudflare.com/app`
- **Landing:** `https://your-url.trycloudflare.com/`

The script also prints a customer-ready block with both URLs when the tunnel is ready.

---

## Install cloudflared

The script tries Homebrew automatically on macOS.

**macOS:**

```bash
brew install cloudflared
```

**Manual download:** [Cloudflare tunnel install docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)

---

## Optional: protect with API key

For open demos, leave `API_KEY` unset (default).

For protected demos:

```bash
export API_KEY=$(openssl rand -hex 32)
echo "Save this key: $API_KEY"
./scripts/share-demo.sh
```

In the console sidebar, paste the key under **API Key**. Tunnel visitors need the key for protected API routes.

---

## Notes

| Topic | Detail |
|-------|--------|
| **Cost** | Free quick tunnel — no Cloudflare account required |
| **Uptime** | Tunnel stops when you press Ctrl+C or close the terminal |
| **URL** | Changes each time you restart the tunnel |
| **Permanent URL** | Requires a free Cloudflare account + named tunnel (not covered here) |
| **Your machine** | Must stay on and running `globe` while the tunnel is active |
| **Tunnel URL file** | Latest URL saved to `.tunnel-url` (gitignored) |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `connection refused` | Ensure `globe` is running on port 8000 — run `./scripts/start-clean.sh` |
| `cloudflared not found` | Run `brew install cloudflared` |
| Port in use | `./scripts/start-clean.sh` |
| Console buttons do nothing | Open DevTools → Console for JS errors; clear **API Key** in sidebar and refresh |
| `401` / invalid API key | Click **Clear key** in sidebar (or clear `localStorage` key `globecloud_api_key`) — leave blank for open demos |
| Slow or hanging requests | Kill zombie on port 8001: `./scripts/start-clean.sh` |
| Slow first load | Wait 10–20s after tunnel URL appears |
| Verify before sharing | `./scripts/smoke-test.sh` |

### Clean restart

If the console misbehaves or you had a regional test node on port 8001:

```bash
./scripts/start-clean.sh
```

Then open http://127.0.0.1:8000/app — click **Route Request** to confirm routing works.

---

## vs Fly.io global deploy

| | Cloudflare Tunnel | Fly.io |
|--|-------------------|--------|
| Credit card | No | Yes |
| Always on | No (local machine) | Yes |
| Custom domain | Account + setup | Fly certs |
| Best for | Demos, sharing with friends | Production |

For production later, see [DEPLOY.md](DEPLOY.md).
