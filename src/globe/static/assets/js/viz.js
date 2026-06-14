(function () {
  const REGION_COORDS = {
    "us-east-1": { lat: 38.9, lon: -77.0, x: 280, y: 220, label: "US East" },
    "eu-west-1": { lat: 53.3, lon: -6.2, x: 480, y: 180, label: "EU West" },
    "ap-south-1": { lat: 19.0, lon: 72.9, x: 720, y: 320, label: "AP South" },
  };

  const DEFAULT_REGIONS = ["us-east-1", "eu-west-1", "ap-south-1"];
  const charts = {};

  function chartTheme() {
    return {
      color: "#ff9900",
      grid: "#3a4553",
      text: "#aab7b8",
      success: "#1d8102",
      warning: "#ff9900",
      danger: "#d13212",
    };
  }

  function showChartUnavailable(canvas) {
    if (!canvas || canvas.dataset.unavailable) return;
    canvas.dataset.unavailable = "1";
    const wrap = canvas.parentElement;
    if (wrap) {
      const note = document.createElement("p");
      note.className = "chart-unavailable";
      note.textContent = "Chart unavailable — check network connection.";
      wrap.appendChild(note);
    }
  }

  function hasChartJs() {
    return typeof Chart !== "undefined";
  }

  function latLonToMap(lat, lon) {
    const x = ((lon + 180) / 360) * 1000;
    const y = ((90 - lat) / 180) * 500;
    return { x: Math.max(20, Math.min(980, x)), y: Math.max(20, Math.min(480, y)) };
  }

  function destroyChart(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  function injectMapBase(svgEl) {
    if (!svgEl || svgEl.dataset.baseLoaded) return;
    fetch("/assets/svg/world-map.svg")
      .then((r) => r.text())
      .then((text) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        const inner = doc.querySelector("svg");
        if (!inner) return;
        while (inner.firstChild) {
          svgEl.appendChild(svgEl.ownerDocument.importNode(inner.firstChild, true));
        }
        svgEl.dataset.baseLoaded = "1";
      })
      .catch(() => {
        svgEl.innerHTML =
          '<rect width="1000" height="500" fill="#161b22"/><text x="500" y="250" text-anchor="middle" fill="#8b949e" font-size="14">Map unavailable</text>';
      });
  }

  function pinColor(healthy) {
    if (healthy === false) return chartTheme().danger;
    return chartTheme().success;
  }

  function renderPin(svg, x, y, id, label, healthy, selected) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", `map-pin ${selected ? "selected" : ""}`);
    g.setAttribute("data-region", id);

    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", x);
    dot.setAttribute("cy", y);
    dot.setAttribute("r", selected ? 7 : 5);
    dot.setAttribute("fill", pinColor(healthy));
    dot.setAttribute("stroke", selected ? "#e6edf3" : "none");
    dot.setAttribute("stroke-width", "1.5");

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x);
    text.setAttribute("y", y - 10);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "map-label");
    text.textContent = label || id;

    g.appendChild(dot);
    g.appendChild(text);
    svg.appendChild(g);
    return g;
  }

  function fleetTableHtml(list) {
    const rows = list
      .map((r) => {
        const id = r.region_id || r;
        return `<tr>
          <td>${id}</td>
          <td>${r.healthy !== false ? '<span class="badge badge-success">ok</span>' : '<span class="badge badge-danger">down</span>'}</td>
          <td>${r.latency_ms != null ? r.latency_ms + " ms" : "—"}</td>
          <td class="muted small">${r.peer_url || "—"}</td>
        </tr>`;
      })
      .join("");
    return `<div class="table-scroll"><table class="fleet-table"><thead><tr><th>Region</th><th>Status</th><th>Latency</th><th>Peer</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderFleetMap(container, regions) {
    if (!container) return;
    const list = regions && regions.length ? regions : DEFAULT_REGIONS.map((id) => ({ region_id: id, healthy: true }));

    container.innerHTML = `<div class="map-container">
      <svg class="world-map" viewBox="0 0 1000 500" xmlns="http://www.w3.org/2000/svg" id="fleet-map-svg"></svg>
    </div>
    <div id="fleet-table-wrap">${fleetTableHtml(list)}</div>`;

    const svg = container.querySelector("#fleet-map-svg");
    injectMapBase(svg);

    setTimeout(() => {
      if (!svg) return;
      svg.querySelectorAll(".map-pin, .map-route, .client-marker").forEach((n) => n.remove());
      list.forEach((r) => {
        const id = r.region_id || r;
        const meta = REGION_COORDS[id] || { x: 500, y: 250, label: id };
        renderPin(svg, meta.x, meta.y, id, meta.label, r.healthy !== false);
      });
    }, 100);
  }

  function updateRoutingMap(svgEl, clientLat, clientLon, selectedRegion, probes) {
    if (!svgEl) return;
    injectMapBase(svgEl);
    setTimeout(() => {
      svgEl.querySelectorAll(".map-pin, .map-route, .client-marker").forEach((n) => n.remove());

      const client = latLonToMap(clientLat, clientLon);
      const clientG = document.createElementNS("http://www.w3.org/2000/svg", "g");
      clientG.setAttribute("class", "client-marker");
      const clientCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      clientCircle.setAttribute("cx", client.x);
      clientCircle.setAttribute("cy", client.y);
      clientCircle.setAttribute("r", 5);
      clientCircle.setAttribute("fill", "#58a6ff");
      clientCircle.setAttribute("stroke", "#e6edf3");
      clientCircle.setAttribute("stroke-width", "1.5");
      clientG.appendChild(clientCircle);
      svgEl.appendChild(clientG);

      (probes || DEFAULT_REGIONS.map((id) => ({ region_id: id, healthy: true }))).forEach((p) => {
        const id = p.region_id;
        const meta = REGION_COORDS[id];
        if (!meta) return;
        renderPin(svgEl, meta.x, meta.y, id, meta.label, p.healthy, id === selectedRegion);
      });

      const sel = REGION_COORDS[selectedRegion];
      if (sel) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("class", "map-route");
        line.setAttribute("x1", client.x);
        line.setAttribute("y1", client.y);
        line.setAttribute("x2", sel.x);
        line.setAttribute("y2", sel.y);
        svgEl.insertBefore(line, svgEl.firstChild);
      }
    }, 50);
  }

  function renderLatencyBars(canvas, probes, selectedRegion) {
    if (!canvas || !hasChartJs()) {
      if (canvas) showChartUnavailable(canvas);
      return;
    }
    const id = canvas.id || "latency-bars";
    canvas.id = id;
    destroyChart(id);
    const theme = chartTheme();
    const labels = (probes || []).map((p) => p.region_id);
    const data = (probes || []).map((p) => p.latency_ms || 0);
    const colors = (probes || []).map((p) =>
      p.region_id === selectedRegion ? theme.color : "rgba(88, 166, 255, 0.35)"
    );
    charts[id] = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderRadius: 2, barThickness: 16 }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: theme.grid },
            ticks: { color: theme.text, font: { size: 11 }, callback: (v) => v + " ms" },
          },
          y: { grid: { display: false }, ticks: { color: theme.text, font: { size: 11 } } },
        },
      },
    });
  }

  function renderOverviewLatencyChart(canvas, router) {
    if (!canvas || !hasChartJs()) {
      if (canvas) showChartUnavailable(canvas);
      return;
    }
    const id = "overview-latency-chart";
    canvas.id = id;
    destroyChart(id);
    const theme = chartTheme();
    charts[id] = new Chart(canvas, {
      type: "bar",
      data: {
        labels: (router || []).map((r) => r.region_id),
        datasets: [{
          data: (router || []).map((r) => r.latency_ms || 0),
          backgroundColor: (router || []).map((r) => (r.healthy ? theme.color : theme.danger)),
          borderRadius: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: theme.grid },
            ticks: { color: theme.text, font: { size: 11 } },
          },
          x: { grid: { display: false }, ticks: { color: theme.text, font: { size: 11 } } },
        },
      },
    });
  }

  function renderLagBars(canvas, lagEntries) {
    if (!canvas || !hasChartJs()) {
      if (canvas) showChartUnavailable(canvas);
      return;
    }
    const id = "lag-bars-chart";
    canvas.id = id;
    destroyChart(id);
    const theme = chartTheme();
    const entries = lagEntries || [];
    charts[id] = new Chart(canvas, {
      type: "bar",
      data: {
        labels: entries.map((e) => e.label),
        datasets: [{
          data: entries.map((e) => e.value),
          backgroundColor: entries.map((e) => (e.value > 10 ? theme.warning : theme.success)),
          borderRadius: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: theme.grid }, ticks: { color: theme.text, font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { color: theme.text, font: { size: 10 }, maxRotation: 45 } },
        },
      },
    });
  }

  function renderSyncTopology(svgEl, syncStatus) {
    if (!svgEl) return;
    const running = syncStatus?.running;
    const regions = Object.keys(syncStatus?.regions || REGION_COORDS);
    if (!regions.length) regions.push(...DEFAULT_REGIONS);

    svgEl.innerHTML = "";
    const w = 360;
    const h = 200;
    svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);

    const hub = { x: w / 2, y: h / 2 };
    const positions = [
      { x: w / 2, y: 28 },
      { x: 48, y: h - 28 },
      { x: w - 48, y: h - 28 },
    ];

    regions.slice(0, 3).forEach((id, i) => {
      const pos = positions[i] || positions[0];
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", hub.x);
      line.setAttribute("y1", hub.y);
      line.setAttribute("x2", pos.x);
      line.setAttribute("y2", pos.y);
      line.setAttribute("class", running ? "topo-line active" : "topo-line");
      svgEl.appendChild(line);
    });

    const hubG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    hubG.innerHTML = `<circle cx="${hub.x}" cy="${hub.y}" r="16" fill="#161b22" stroke="#58a6ff" stroke-width="1.5"/>
      <text x="${hub.x}" y="${hub.y + 4}" text-anchor="middle" fill="#8b949e" font-size="10">sync</text>`;
    svgEl.appendChild(hubG);

    regions.slice(0, 3).forEach((id, i) => {
      const pos = positions[i] || positions[0];
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.innerHTML = `<circle cx="${pos.x}" cy="${pos.y}" r="14" fill="#161b22" stroke="#3fb950" stroke-width="1.5"/>
        <text x="${pos.x}" y="${pos.y + 3}" text-anchor="middle" fill="#8b949e" font-size="8">${id.split("-")[0]}</text>`;
      svgEl.appendChild(g);
    });
  }

  function citationCards(citations) {
    if (!citations?.length) return "";
    return `<div class="citation-cards">${citations
      .map(
        (c) => `<div class="citation-card">${c.title} · ${c.region} · score ${c.score}</div>`
      )
      .join("")}</div>`;
  }

  function stockBar(stock, maxStock) {
    const max = maxStock || 100;
    const pct = Math.min((stock / max) * 100, 100);
    const cls = pct > 50 ? "high" : pct > 20 ? "medium" : "low";
    return `<div class="stock-bar"><div class="stock-bar-fill ${cls}" style="width:${pct}%"></div></div>`;
  }

  function healthBarRow(r, circuitBadgeFn) {
    const maxLat = 600;
    const pct = r.latency_ms ? Math.min((r.latency_ms / maxLat) * 100, 100) : 0;
    const badge = circuitBadgeFn ? circuitBadgeFn(r.circuit) : "";
    return `<div class="health-bar-row">
      <div class="health-bar-header">
        <strong>${r.region_id}</strong>
        <span class="small muted">${r.latency_ms != null ? r.latency_ms + " ms" : "—"}</span>
      </div>
      <div class="health-bar-track">
        <div class="health-bar-fill ${r.healthy ? "healthy" : "degraded"}" style="width:${pct}%"></div>
      </div>
      <div class="health-bar-badges">
        ${r.healthy ? '<span class="badge badge-success">ok</span>' : '<span class="badge badge-danger">down</span>'}
        ${badge}
      </div>
    </div>`;
  }

  function routeResultTable(probes, selectedRegion) {
    if (!probes?.length) return "";
    const rows = probes
      .map(
        (p) => `<tr${p.region_id === selectedRegion ? ' style="background:var(--accent-soft)"' : ""}>
          <td>${p.region_id}${p.region_id === selectedRegion ? " ← selected" : ""}</td>
          <td>${p.healthy ? "ok" : "down"}</td>
          <td>${p.latency_ms ?? "—"} ms</td>
          <td>${p.circuit || "—"}</td>
        </tr>`
      )
      .join("");
    return `<div class="table-scroll route-table"><table><thead><tr><th>Region</th><th>Health</th><th>Latency</th><th>Circuit</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  window.GlobeViz = {
    REGION_COORDS,
    chartTheme,
    destroyChart,
    latLonToMap,
    renderFleetMap,
    updateRoutingMap,
    renderLatencyBars,
    renderOverviewLatencyChart,
    renderLagBars,
    renderSyncTopology,
    citationCards,
    stockBar,
    healthBarRow,
    routeResultTable,
    hasChartJs,
  };
})();
