/**
 * GlobeCloud console — rebuilt with delegation-first event handling.
 */
(function () {
  "use strict";

  if (!window.GlobeAPI) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<div class="init-error-banner" role="alert">Console scripts failed to load. Hard-refresh (Cmd+Shift+R) or restart the server.</div>'
    );
    return;
  }

  const { api, getApiKey, setApiKey, clearApiKey, toast, showConnectionBanner, confidenceBadge } =
    window.GlobeAPI;
  const viz = window.GlobeViz || {};

  const PANELS = {
    overview: "Overview",
    fleet: "Global Fleet",
    routing: "Routing",
    inventory: "Inventory",
    replication: "Replication",
    copilot: "Copilot",
  };

  const CHECKLIST_KEY = "globecloud_checklist";

  const state = {
    lat: 40.71,
    lon: -74.01,
    region: "us-east-1",
    isGateway: false,
    authRequired: false,
    lastSync: null,
  };

  // ── Checklist ─────────────────────────────────────────────────────────────

  function loadChecklist() {
    try {
      return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveChecklist(data) {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(data));
  }

  function markStep(step) {
    const data = loadChecklist();
    if (data[step]) return;
    data[step] = true;
    saveChecklist(data);
    renderChecklist();
  }

  function renderChecklist() {
    const data = loadChecklist();
    document.querySelectorAll(".checklist-item[data-step]").forEach((el) => {
      const done = !!data[el.dataset.step];
      el.classList.toggle("done", done);
      const icon = el.querySelector(".checklist-icon");
      if (icon) icon.textContent = done ? "✓" : "○";
    });
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function setBadge(id, text, kind) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.className = `badge badge-${kind}`;
  }

  function showBanner(msg) {
    showConnectionBanner(msg || "");
  }

  function switchPanel(name) {
    if (typeof window.globeSwitchPanel === "function") {
      window.globeSwitchPanel(name);
    } else {
      document.querySelectorAll(".nav-item[data-panel], .bottom-nav-item[data-panel]").forEach((el) => {
        el.classList.toggle("active", el.dataset.panel === name);
      });
      document.querySelectorAll(".panel").forEach((el) => {
        el.classList.toggle("active", el.id === `panel-${name}`);
      });
      setText("panel-title", PANELS[name] || name);
    }
    if (name === "inventory") loadProducts();
    if (name === "replication") loadSync();
    if (name === "fleet") loadFleet();
  }

  function setRegion(regionId, quiet) {
    state.region = regionId;
    const sel = $("inv-region");
    if (sel) sel.value = regionId;
    document.querySelectorAll(".region-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.region === regionId);
    });
    if (!quiet) toast(`Inventory → ${regionId}`);
  }

  function configureGateway(on) {
    state.isGateway = on;
    ["nav-fleet", "bottom-nav-fleet"].forEach((id) => {
      const el = $(id);
      if (el) el.hidden = !on;
    });
    const badge = $("gateway-badge");
    if (badge) badge.hidden = !on;
  }

  function configureAuth(product) {
    state.authRequired = !!product?.auth_required;
    const label = state.authRequired ? "API key (required)" : "API key (optional)";
    setText("api-key-label", label);
    setText("api-key-label-mobile", label);
    if (state.authRequired && !getApiKey()) {
      showBanner("API key required — paste your key in Settings.");
    }
  }

  async function withBusy(btn, label, fn) {
    if (btn && (btn.disabled || btn.classList.contains("is-loading"))) return;
    const original = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-loading");
      btn.textContent = label;
    }
    try {
      await fn();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("is-loading");
        btn.textContent = original;
      }
    }
  }

  // ── API views ─────────────────────────────────────────────────────────────

  async function loadMeta() {
    try {
      const product = await api("/product");
      configureGateway(product.deployment_mode === "gateway");
      configureAuth(product);
      showBanner("");
      return product;
    } catch (err) {
      if (String(err.message).includes("401")) configureAuth({ auth_required: true });
      showBanner(`Cannot reach API: ${err.message}`);
      return null;
    }
  }

  async function loadHealth() {
    try {
      const [health, product, metrics] = await Promise.all([
        api("/health"),
        api("/product"),
        api("/metrics"),
      ]);
      configureGateway(product.deployment_mode === "gateway");
      configureAuth(product);
      showBanner("");

      const healthy = metrics.router.filter((r) => r.healthy).length;
      setBadge(
        "health-badge",
        state.isGateway ? `${health.healthy_regions ?? "?"}/${product.regions} regions` : "online",
        "success"
      );
      const llm = health.llm_mode === "openai" ? "OpenAI" : "mock";
      setBadge("llm-badge", `${llm} · ${product.deployment_mode || "local"}`, "muted");
      setText("stat-regions", product.regions);
      setText("stat-healthy", metrics.router.length ? `${healthy}/${metrics.router.length}` : "—");
      setText(
        "stat-cache",
        metrics.inference_cache?.hit_rate != null
          ? `${Math.round(metrics.inference_cache.hit_rate * 100)}%`
          : "—"
      );

      const regionsEl = $("overview-regions");
      if (regionsEl) {
        regionsEl.innerHTML = metrics.router
          .map(
            (r) =>
              `<div class="region-row"><span>${r.region_id}</span>${r.healthy ? '<span class="badge badge-success">ok</span>' : '<span class="badge badge-danger">down</span>'}<span class="muted">${r.latency_ms ?? "—"} ms</span></div>`
          )
          .join("");
      }

      const chart = $("overview-latency-chart");
      if (chart && viz.renderOverviewLatencyChart) viz.renderOverviewLatencyChart(chart, metrics.router);

      markStep("connected");
    } catch (err) {
      setBadge("health-badge", "offline", "danger");
      showBanner(`Connection failed: ${err.message}`);
    }
  }

  async function loadOverviewStats() {
    try {
      const sync = await api("/sync/status");
      setText("stat-cycles", sync.cycles ?? 0);
    } catch {
      setText("stat-cycles", "—");
    }
  }

  async function loadFleet() {
    const el = $("fleet-cards");
    if (!el) return;
    try {
      const data = await api("/global/status");
      if (viz.renderFleetMap) viz.renderFleetMap(el, data.regions);
      else el.innerHTML = data.regions.map((r) => `<div class="card">${r.region_id}</div>`).join("");
    } catch (err) {
      el.innerHTML = `<p class="muted">${err.message}</p>`;
    }
  }

  async function runRoute(btn) {
    await withBusy(btn, "Routing…", async () => {
      const lat = parseFloat($("route-lat")?.value ?? state.lat);
      const lon = parseFloat($("route-lon")?.value ?? state.lon);
      const preferred = $("route-preferred")?.value || "";
      state.lat = lat;
      state.lon = lon;

      const params = new URLSearchParams({ client_lat: lat, client_lon: lon });
      if (preferred) params.set("preferred_region", preferred);

      const data = await api(`/route?${params}`);
      const map = $("routing-map-svg");
      if (map && viz.updateRoutingMap) viz.updateRoutingMap(map, lat, lon, data.selected_region, data.probes);
      const chart = $("routing-latency-chart");
      if (chart && viz.renderLatencyBars) viz.renderLatencyBars(chart, data.probes, data.selected_region);

      const table = viz.routeResultTable ? viz.routeResultTable(data.probes, data.selected_region) : "";
      const result = $("route-result");
      if (result) {
        result.innerHTML = `<div class="route-selected"><strong>${data.selected_name}</strong> (${data.selected_region})</div>${table}`;
      }

      setRegion(data.selected_region, true);
      markStep("routed");
      loadHealth();
    });
  }

  function renderProducts(products, region) {
    const grid = $("product-grid");
    const tbody = $("products-body");
    const maxStock = Math.max(...products.map((p) => p.stock), 1);

    const card = (p) => `
      <div class="card product-card">
        <strong>${p.name}</strong>
        <p class="small muted">${p.sku} · $${p.price.toFixed(2)} · stock ${p.stock}</p>
        ${viz.stockBar ? viz.stockBar(p.stock, maxStock) : ""}
        <button type="button" class="btn btn-secondary small" data-action="order" data-id="${p.id}">Order 1</button>
      </div>`;

    const row = (p) => `
      <tr>
        <td>${p.name}</td><td class="muted">${p.sku}</td>
        <td>$${p.price.toFixed(2)}</td><td>${p.stock}</td>
        <td><button type="button" class="btn btn-secondary small" data-action="order" data-id="${p.id}">Order</button></td>
      </tr>`;

    if (grid) grid.innerHTML = products.map(card).join("");
    if (tbody) tbody.innerHTML = products.map(row).join("");
  }

  async function loadProducts() {
    const region = $("inv-region")?.value || state.region;
    try {
      const data = await api(`/regions/${region}/products`);
      const note = $("inv-remote-note");
      if (note) {
        note.innerHTML =
          data.is_local === false || state.isGateway
            ? `<p class="small muted">Via ${state.isGateway ? "gateway → " : ""}${region}</p>`
            : "";
      }
      if (!data.products?.length) {
        if ($("product-grid")) $("product-grid").innerHTML = '<p class="muted">No products.</p>';
        if ($("products-body")) $("products-body").innerHTML = "";
        return;
      }
      renderProducts(data.products, region);
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function placeOrder(productId, btn) {
    const region = $("inv-region")?.value || state.region;
    await withBusy(btn, "Ordering…", async () => {
      await api(`/regions/${region}/orders`, {
        method: "POST",
        body: JSON.stringify({ product_id: productId, quantity: 1 }),
      });
      toast("Order placed");
      markStep("ordered");
      await loadProducts();
    });
  }

  async function loadSync() {
    try {
      const sync = await api("/sync/status");
      state.lastSync = sync;
      setText("stat-cycles", sync.cycles ?? 0);

      const topo = $("sync-topology-svg");
      if (topo && viz.renderSyncTopology) viz.renderSyncTopology(topo, sync);

      const summary = $("sync-summary");
      if (summary) {
        summary.innerHTML = `<p>Running: ${sync.running ? "yes" : "no"} · Cycles: ${sync.cycles ?? 0}</p>`;
      }

      const lag = $("sync-lag");
      if (lag) {
        lag.innerHTML = Object.entries(sync.regions || {})
          .map(([id, r]) => `<div class="small">${id}: ${r.stats?.entries ?? 0} entries</div>`)
          .join("");
      }

      const chart = $("lag-bars-chart");
      if (chart && viz.renderLagBars) {
        const lagEntries = [];
        Object.entries(sync.regions || {}).forEach(([regionId, r]) => {
          (r.sync_lag || []).forEach((entry) => {
            lagEntries.push({
              label: `${regionId}→${entry.peer_region}`,
              value: entry.behind_by ?? 0,
            });
          });
        });
        viz.renderLagBars(chart, lagEntries);
      }
    } catch (err) {
      if ($("sync-summary")) $("sync-summary").innerHTML = `<p class="muted">${err.message}</p>`;
    }
  }

  async function forceSync(btn) {
    await withBusy(btn, "Syncing…", async () => {
      const topo = $("sync-topology-svg");
      if (topo && viz.renderSyncTopology && state.lastSync) {
        viz.renderSyncTopology(topo, { ...state.lastSync, running: true });
      }
      const result = await api("/sync/run", { method: "POST" });
      toast(`Synced ${result.entries_applied ?? 0} entries`);
      await loadSync();
      loadOverviewStats();
      if (state.isGateway) loadFleet();
    });
  }

  function appendChat(text, role, extras) {
    const box = $("chat-messages");
    if (!box) return;
    const el = document.createElement("div");
    el.className = `msg ${role}`;
    el.innerHTML = text + (extras || "");
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }

  async function askCopilot(question, btn) {
    const q = question || $("chat-input")?.value?.trim();
    if (!q) return;
    if ($("chat-input")) $("chat-input").value = "";

    await withBusy(btn, "Thinking…", async () => {
      appendChat(q, "user");
      const data = await api("/agent/ask", {
        method: "POST",
        body: JSON.stringify({ question: q, client_lat: state.lat, client_lon: state.lon }),
      });
      const backend = data.backend_region
        ? `<span class="badge badge-muted">${data.backend_region}</span> `
        : "";
      const cites = viz.citationCards ? viz.citationCards(data.citations) : "";
      const answer = data.answer.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
      appendChat(
        answer,
        "agent",
        `<div class="small" style="margin-top:0.5rem">${backend}${confidenceBadge(data.confidence)} · ${data.inference.provider}</div>${cites}`
      );
      markStep("asked");
    });
  }

  async function runDemo(btn) {
    await withBusy(btn, "Running demo…", async () => {
      switchPanel("routing");
      if ($("route-lat")) $("route-lat").value = "40.0";
      if ($("route-lon")) $("route-lon").value = "-74.0";
      const route = await api("/route?client_lat=40.0&client_lon=-74.0");
      state.lat = 40;
      state.lon = -74;
      setRegion(route.selected_region, true);
      markStep("routed");

      switchPanel("inventory");
      const inv = await api(`/regions/${route.selected_region}/products`);
      renderProducts(inv.products, route.selected_region);

      await api(`/regions/${route.selected_region}/orders`, {
        method: "POST",
        body: JSON.stringify({ product_id: "prod-001", quantity: 1 }),
      });
      markStep("ordered");
      await loadProducts();

      if (!state.isGateway) {
        switchPanel("replication");
        await api("/sync/run", { method: "POST" });
        await loadSync();
      }

      switchPanel("copilot");
      await askCopilot("How does cross-region replication work?");
      toast("Demo complete");
      switchPanel("overview");
      loadHealth();
    });
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  function openSettings() {
    $("settings-drawer")?.classList.add("open");
    $("settings-drawer")?.setAttribute("aria-hidden", "false");
    const mobile = $("api-key-input-mobile");
    if (mobile) mobile.value = getApiKey();
  }

  function closeSettings() {
    $("settings-drawer")?.classList.remove("open");
    $("settings-drawer")?.setAttribute("aria-hidden", "true");
  }

  function syncApiKeyInputs() {
    const val = getApiKey();
    if ($("api-key-input")) $("api-key-input").value = val;
    if ($("api-key-input-mobile")) $("api-key-input-mobile").value = val;
  }

  function saveApiKey(value) {
    setApiKey(value.trim());
    syncApiKeyInputs();
    toast("API key saved");
    showBanner("");
    loadHealth();
  }

  // ── Event delegation (single handler) ─────────────────────────────────────

  document.addEventListener(
    "click",
    (event) => {
      const el = event.target.closest("[data-action]");
      if (!el) return;

      const action = el.dataset.action;
      switch (action) {
        case "nav":
          switchPanel(el.dataset.panel);
          break;
        case "route":
          runRoute(el);
          break;
        case "geolocate":
          if (!navigator.geolocation) return toast("Geolocation unavailable", true);
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if ($("route-lat")) $("route-lat").value = pos.coords.latitude.toFixed(2);
              if ($("route-lon")) $("route-lon").value = pos.coords.longitude.toFixed(2);
              runRoute();
            },
            () => toast("Could not get location", true)
          );
          break;
        case "preset":
          if ($("route-lat")) $("route-lat").value = el.dataset.lat;
          if ($("route-lon")) $("route-lon").value = el.dataset.lon;
          runRoute();
          break;
        case "region":
          setRegion(el.dataset.region);
          loadProducts();
          break;
        case "refresh-products":
          loadProducts();
          break;
        case "order":
          placeOrder(el.dataset.id, el);
          break;
        case "sync":
          forceSync(el);
          break;
        case "demo":
          runDemo(el);
          break;
        case "ask":
          askCopilot(null, el);
          break;
        case "ask-prompt":
          askCopilot(el.dataset.prompt, el);
          break;
        case "open-settings":
          openSettings();
          break;
        case "close-settings":
          closeSettings();
          break;
        case "clear-key":
          clearApiKey();
          syncApiKeyInputs();
          toast("API key cleared");
          loadHealth();
          break;
        case "reset-tutorial":
          localStorage.removeItem(CHECKLIST_KEY);
          renderChecklist();
          toast("Tutorial reset");
          closeSettings();
          break;
        default:
          break;
      }
    },
    true
  );

  $("chat-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") askCopilot(null, null);
  });

  $("api-key-input")?.addEventListener("change", (e) => saveApiKey(e.target.value));
  $("api-key-input-mobile")?.addEventListener("change", (e) => saveApiKey(e.target.value));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("settings-drawer")?.classList.contains("open")) closeSettings();
  });

  // ── Boot ──────────────────────────────────────────────────────────────────

  async function boot() {
    renderChecklist();
    syncApiKeyInputs();
    await loadMeta();
    await loadHealth();
    loadOverviewStats();
    if (state.isGateway) {
      loadFleet();
    } else {
      runRoute().catch(() => {});
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot().catch((e) => showBanner(e.message)));
  } else {
    boot().catch((e) => showBanner(e.message));
  }

  setInterval(loadOverviewStats, 5000);
  setInterval(() => {
    loadHealth();
    if (state.isGateway) loadFleet();
  }, 15000);

  window.__globeConsoleReady = true;
})();
