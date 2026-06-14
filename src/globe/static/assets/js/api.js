const API_BASE = "/api/v1";

function getApiKey() {
  return localStorage.getItem("globecloud_api_key") || "";
}

function setApiKey(key) {
  if (key) localStorage.setItem("globecloud_api_key", key);
  else localStorage.removeItem("globecloud_api_key");
}

function clearApiKey() {
  setApiKey("");
  const input = document.getElementById("api-key-input");
  if (input) input.value = "";
}

async function api(path, options = {}, retried = false) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const key = getApiKey();
  if (key) headers["X-API-Key"] = key;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const message =
      typeof detail.detail === "string"
        ? detail.detail
        : `Request failed (${response.status})`;

    if (response.status === 401 && key) {
      clearApiKey();
      if (!retried) {
        return api(path, options, true);
      }
      throw new Error(`${message} — API key cleared. Leave blank for open demos.`);
    }
    throw new Error(message);
  }
  return response.json();
}

function toast(message, isError = false) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.borderColor = isError ? "var(--danger)" : "var(--border)";
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 4200);
}

function showConnectionBanner(message) {
  const el = document.getElementById("connection-banner");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.classList.add("show");
  } else {
    el.textContent = "";
    el.classList.remove("show");
  }
}

function confidenceBadge(level) {
  const cls =
    level === "high" ? "badge-success" : level === "medium" ? "badge-warning" : "badge-danger";
  return `<span class="badge ${cls}">${level}</span>`;
}

function circuitBadge(state) {
  const cls =
    state === "closed" ? "badge-success" : state === "half_open" ? "badge-warning" : "badge-danger";
  return `<span class="badge ${cls}">${state || "unknown"}</span>`;
}

window.GlobeAPI = {
  api,
  getApiKey,
  setApiKey,
  clearApiKey,
  toast,
  showConnectionBanner,
  confidenceBadge,
  circuitBadge,
};
