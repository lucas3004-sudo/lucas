// AI Agency OS dashboard - no build step. Each page is an ES module in /static/pages/<id>.js exporting render(el, params).
export const PAGES = [
  ["overview", "Overview", "◉"], ["daily", "Daily Board", "☑"], ["studio", "Content Studio", "▤"],
  ["generator", "Generator", "✦"], ["calendar", "Calendar", "▦"], ["agents", "Agents", "⚙"],
  ["character", "Character Studio", "☺"], ["growth", "Growth Center", "↗"], ["community", "Community", "✉"],
  ["analytics", "Analytics", "▥"], ["finance", "Finance", "€"], ["integrations", "Integrations", "⇄"],
  ["usage", "Token & Usage", "Σ"], ["settings", "Settings", "☰"],
];

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const token = store.get("agency_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  let body = opts.body;
  if (body && !(body instanceof FormData) && typeof body !== "string") { body = JSON.stringify(body); headers["Content-Type"] = "application/json"; }
  const res = await fetch(`/api${path}`, { ...opts, headers, body });
  if (res.status === 401) {
    const t = prompt("Jeton d'administration (AGENCY_ADMIN_TOKEN) :");
    if (t) { store.set("agency_token", t); return api(path, opts); }
  }
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("json") ? await res.json() : await res.text();
  if (!res.ok) throw new Error(typeof data === "string" ? data : (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data)));
  return data;
}
export const assetUrl = (u) => { const t = store.get("agency_token"); return t ? `${u}?token=${encodeURIComponent(t)}` : u; };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const safeUrl = (u) => (/^(https?:\/\/|#\/)/i.test(String(u || "")) ? esc(u) : "#");
export const fmt = {
  num: (n) => (n == null ? "—" : Number(n).toLocaleString("fr-FR")),
  usd: (n) => (n == null ? "—" : `${Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} $`),
  eur: (n) => (n == null ? "—" : `${Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`),
  pct: (n) => (n == null ? "—" : `${(n * 100).toFixed(1)} %`),
  dt: (s) => (s ? new Date(s).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—"),
  date: (s) => (s ? new Date(s).toLocaleDateString("fr-FR") : "—"),
};
const LABELS = {
  in_progress: ["En cours", "info"], waiting_assets: ["Visuels attendus", "warn"], needs_revision: ["À revoir", "crit"],
  awaiting_approval: ["À valider", "warn"], approved: ["Approuvé", "good"], scheduled: ["Planifié", "info"],
  ready_to_publish: ["À publier", "warn"], published: ["Publié", "good"], rejected: ["Rejeté", ""], failed: ["Échec", "crit"],
  queued: ["En file", ""], running: ["En cours", "info"], waiting: ["Attente Claude Code", "warn"], done: ["Terminé", "good"],
  dead: ["Abandonné", "crit"], cancelled: ["Annulé", ""], completed: ["Terminé", "good"], stopped: ["Arrêté", ""],
  paused: ["En pause", "warn"], active: ["Actif", "good"], new: ["Nouveau", "info"], drafted: ["Réponse prête", "good"],
  needs_human: ["Humain requis", "crit"], replied: ["Répondu", ""], ignored: ["Ignoré", ""],
  verified: ["Vérifié", "good"], configured: ["Configuré (non testé)", "warn"], not_configured: ["Non configuré", ""],
  error: ["Erreur", "crit"], unavailable: ["Non intégré", ""], proposed: ["Proposée", ""], concluded: ["Conclue", "good"], dropped: ["Abandonnée", ""],
};
const ICON = { good: "✓ ", warn: "! ", crit: "✕ ", info: "" };
export function badge(status) {
  const [label, cls] = LABELS[status] || [status, ""];
  return `<span class="badge ${cls}">${ICON[cls] || ""}${esc(label)}</span>`;
}
const PROV = {
  measured: "mesuré", manual: "saisi", estimated: "estimé", forecast: "prévision", template: "modèle hors ligne",
  hypothesis: "hypothèse", observed: "observé (source)", "n/a": "n/a",
};
export const prov = (p) => `<span class="prov" title="Provenance de la donnée">${esc(PROV[p] || p)}</span>`;
export function toast(msg, ms = 3500) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg; document.body.append(t);
  setTimeout(() => t.remove(), ms);
}
export async function act(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { toast(`Erreur : ${e.message}`, 6000); return null; }
}
export const qs = (params) => new URLSearchParams(params).toString();
export function go(hash) { location.hash = hash; }

// --- shell ------------------------------------------------------------------
const nav = document.getElementById("nav");
nav.innerHTML = PAGES.map(([id, label, ic]) => `<a href="#/${id}" data-page="${id}"><span class="ic">${ic}</span>${label}<span class="count" id="count-${id}" hidden></span></a>`).join("");
document.getElementById("menu").onclick = () => document.getElementById("side").classList.toggle("open");
document.getElementById("theme").onclick = () => {
  const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next; store.set("agency_theme", next);
};
if (store.get("agency_theme")) document.documentElement.dataset.theme = store.get("agency_theme");

let timer = null;
let current = null;
async function route() {
  const [path, query] = (location.hash.replace(/^#\/?/, "") || "overview").split("?");
  const id = PAGES.some((p) => p[0] === path) ? path : "overview";
  const params = Object.fromEntries(new URLSearchParams(query || ""));
  nav.querySelectorAll("a").forEach((a) => a.classList.toggle("on", a.dataset.page === id));
  document.getElementById("side").classList.remove("open");
  clearInterval(timer);
  const el = document.getElementById("page");
  if (current !== id) el.innerHTML = '<p class="empty">Chargement…</p>';
  current = id;
  try {
    const mod = await import(`./pages/${id}.js`);
    await mod.render(el, params);
    const typing = () => el.contains(document.activeElement) && document.activeElement.matches("input,textarea,select");
    if (mod.poll) timer = setInterval(() => { if (!document.hidden && !typing()) mod.render(el, params, true); }, mod.poll * 1000);
  } catch (e) {
    el.innerHTML = `<div class="card"><h2>Erreur</h2><p>${esc(e.message)}</p></div>`;
  }
  document.title = `${PAGES.find((p) => p[0] === id)[1]} · AI Agency OS`;
}
window.addEventListener("hashchange", route);
export const rerender = route;

async function refreshTop() {
  try {
    const o = await api("/overview");
    const s = o.agency.status;
    document.getElementById("state-pill").outerHTML = `<span id="state-pill">${badge(s === "running" ? "active" : s)}</span>`;
    document.getElementById("mode-pill").textContent = `LLM : ${o.usage_30d.mode}`;
    document.getElementById("bell-n").textContent = o.alerts.length;
    const d = (o.contents.awaiting_approval || 0) + (o.contents.waiting_assets || 0) + (o.contents.ready_to_publish || 0);
    const c = document.getElementById("count-daily"); c.hidden = !d; c.textContent = d;
  } catch { /* shown by page */ }
}
setInterval(() => { if (!document.hidden) refreshTop(); }, 8000);
refreshTop();
route();
