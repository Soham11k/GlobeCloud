document.addEventListener("DOMContentLoaded", async () => {
  const fleetEl = document.getElementById("global-fleet");
  const statusEl = document.getElementById("hero-status");
  const infraSection = document.getElementById("global-infra");
  const viz = window.GlobeViz;

  const headers = {};
  const key = localStorage.getItem("globecloud_api_key");
  if (key) headers["X-API-Key"] = key;

  let serverOnline = false;
  let authRequired = false;
  let productMeta = null;

  try {
    const healthRes = await fetch("/api/v1/health", { headers });
    if (healthRes.ok) {
      serverOnline = true;
    }
  } catch (_) {}

  try {
    const productRes = await fetch("/api/v1/product", { headers });
    if (productRes.status === 401) {
      serverOnline = true;
      authRequired = true;
      if (statusEl) statusEl.textContent = "Server online — API key required for full access";
    } else if (productRes.ok) {
      serverOnline = true;
      productMeta = await productRes.json();
      if (statusEl) {
        const modeLabel =
          productMeta.deployment_mode === "local" ? "local demo" : productMeta.deployment_mode || "local";
        statusEl.textContent = `${productMeta.regions} regions · ${modeLabel} · ${productMeta.llm_mode || "mock"} LLM`;
      }
    }
  } catch (_) {
    if (!serverOnline && statusEl) {
      statusEl.textContent = "Demo offline — ask your host to run ./scripts/share-demo.sh";
    }
  }

  if (!fleetEl) return;

  function showBanner(className, message) {
    if (!infraSection) return;
    const existing = infraSection.querySelector(".demo-banner, .demo-offline-banner, .demo-auth-banner");
    existing?.remove();
    const banner = document.createElement("p");
    banner.className = className;
    banner.textContent = message;
    infraSection.insertBefore(banner, fleetEl);
  }

  if (!serverOnline) {
    showBanner(
      "demo-offline-banner",
      "Demo offline — ask your host to run ./scripts/share-demo.sh"
    );
    fleetEl.innerHTML = '<p class="muted">Start the server to see live region status.</p>';
    return;
  }

  if (authRequired) {
    showBanner("demo-auth-banner", "API key required — open the console and paste your key in Settings.");
  }

  async function loadFromGateway() {
    const response = await fetch("/api/v1/global/status", { headers });
    if (!response.ok) return null;
    return response.json();
  }

  async function loadFromMetrics() {
    const response = await fetch("/api/v1/metrics", { headers });
    if (!response.ok) return null;
    const metrics = await response.json();
    return {
      regions: (metrics.router || []).map((r) => ({
        region_id: r.region_id,
        healthy: r.healthy,
        latency_ms: r.latency_ms,
        peer_url: r.peer_url || null,
      })),
      localDemo: true,
    };
  }

  try {
    let data = await loadFromGateway();
    if (!data) data = await loadFromMetrics();

    if (data?.localDemo) {
      const count = productMeta?.regions ?? data.regions?.length ?? 3;
      showBanner("demo-banner", `Live demo — ${count} regions simulated locally on this instance.`);
    }

    if (!data?.regions?.length) {
      fleetEl.innerHTML = '<p class="muted">No region data yet. Open the console to run a route.</p>';
      return;
    }

    if (viz) {
      viz.renderFleetMap(fleetEl, data.regions);
    } else {
      fleetEl.innerHTML = renderFleetTable(data.regions);
    }
  } catch (_) {
    fleetEl.innerHTML = '<p class="muted">Could not load region status.</p>';
  }

  function renderFleetTable(regions) {
    const rows = regions
      .map(
        (r) => `<tr>
          <td>${r.region_id}</td>
          <td>${r.healthy !== false ? '<span class="badge badge-success">ok</span>' : '<span class="badge badge-danger">down</span>'}</td>
          <td>${r.latency_ms != null ? r.latency_ms + " ms" : "—"}</td>
        </tr>`
      )
      .join("");
    return `<div class="table-scroll"><table class="fleet-table"><thead><tr><th>Region</th><th>Status</th><th>Latency</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
});
