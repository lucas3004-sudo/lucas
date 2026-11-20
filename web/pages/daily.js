import { api, act, badge, esc, fmt } from "../app.js";

export const poll = 10;

const block = (title, items, row, empty = "Rien à faire") =>
  `<div class="card"><h2>${title} <span class="badge">${items.length}</span></h2>${items.length ? `<div class="list">${items.map(row).join("")}</div>` : `<p class="empty">${empty}</p>`}</div>`;

export async function render(el, _p, silent) {
  const [d, briefs] = await Promise.all([api("/daily"), api("/briefs")]);
  if (silent && el.querySelector("#brief-view")?.dataset.open) return;
  const c = (x, extra = "") => `<div class="item"><div><a class="t" href="#/studio?c=${x.id}">${esc(x.title)}</a><div class="m">${esc(x.platform)} · ${esc(x.format)} · ${fmt.dt(x.updated_at)}</div></div><div class="row">${extra}</div></div>`;
  el.innerHTML = `
  <h1>Daily Board</h1><p class="sub">Tout ce qui attend une décision humaine aujourd'hui.</p>
  <div class="grid g2">
    ${block("À valider", d.approvals, (x) => c(x, `<button class="btn sm primary" data-approve="${x.id}">Approuver</button><a class="btn sm" href="#/studio?c=${x.id}">Voir</a>`))}
    ${block("Visuels à générer (Alexya → Drop)", d.assets_needed, (x) => c(x, `<a class="btn sm primary" href="#/generator?c=${x.id}">Ouvrir le Generator</a>`))}
    ${block("À revoir", d.revisions, (x) => c(x, `<a class="btn sm" href="#/studio?c=${x.id}">Corriger</a>`))}
    ${block("À publier manuellement", d.to_publish, (x) => c(x, `<a class="btn sm" href="#/studio?c=${x.id}">Paquet d'export</a>`))}
    ${block("Messages pour un humain", d.messages, (m) => `<div class="item"><div><div class="t">${esc(m.author || "anonyme")} · ${esc(m.platform)}</div><div class="m">${esc(m.text)}</div></div><span class="badge crit">✕ ${esc(m.escalation_reason || "")}</span></div>`)}
    ${block("Tâches en échec", d.failed_jobs, (j) => `<div class="item"><div><code>${esc(j.type)}</code><div class="m">${esc((j.last_error || "").slice(0, 160))}</div></div><button class="btn sm" data-retry="${j.id}">Relancer</button></div>`)}
    ${block("Tâches pour Claude Code", d.cc_tasks, (t) => `<div class="item"><div><code>${esc(t.task_id)}</code><div class="m">${esc(t.agent)} · ${esc(t.task)}</div></div></div>`,
      "Aucune. En mode claude_code, ouvrez Claude Code dans le projet et tapez : /agency-run-tasks")}
    ${block("Publications du jour", d.today, (x) => `<div class="item"><a href="#/studio?c=${x.id}">${esc(x.title)}</a><span class="m">${esc(x.platform)} · ${fmt.dt(x.scheduled_at)}</span></div>`)}
  </div>
  <div class="card" style="margin-top:16px"><div class="row between"><h2>Rapports quotidiens</h2><button class="btn sm" id="gen">Générer le rapport du jour</button></div>
    <div class="row">${briefs.map((b) => `<button class="btn sm" data-brief="${b}">${b}</button>`).join("") || `<span class="m">Aucun rapport (généré chaque soir à 21:00 ou à la demande)</span>`}</div>
    <div id="brief-view" class="pre" style="margin-top:12px" hidden></div></div>`;

  el.querySelectorAll("[data-approve]").forEach((b) => (b.onclick = async () => { await act(() => api(`/contents/${b.dataset.approve}/approve`, { method: "POST", body: {} }), "Approuvé et planifié"); render(el); }));
  el.querySelectorAll("[data-retry]").forEach((b) => (b.onclick = async () => { await act(() => api(`/jobs/${b.dataset.retry}/retry`, { method: "POST" }), "Relancée"); render(el); }));
  const view = el.querySelector("#brief-view");
  el.querySelectorAll("[data-brief]").forEach((b) => (b.onclick = async () => { view.hidden = false; view.dataset.open = "1"; view.textContent = await api(`/briefs/${b.dataset.brief}`); }));
  el.querySelector("#gen").onclick = async () => { const r = await act(() => api("/briefs/generate", { method: "POST" }), "Rapport généré"); if (r) render(el); };
}
