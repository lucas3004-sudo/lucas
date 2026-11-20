import { api, act, badge, esc, fmt } from "../app.js";

export const poll = 6;

export async function render(el) {
  const [agents, jobs, runs] = await Promise.all([api("/agents"), api("/jobs?limit=60"), api("/runs")]);
  el.innerHTML = `<h1>Agents</h1><p class="sub">11 agents regroupant les 37 rôles. Mettez en pause, arrêtez ou relancez chacun (relancer = réactiver + reprogrammer ses tâches en échec).</p>
  <div class="grid g2">${agents.map((a) => `<div class="card">
    <div class="row between"><div><h2 style="margin:0">${esc(a.name)}</h2><div class="m">${esc(a.roles.join(" · "))}</div></div>${badge(a.status)}</div>
    <p>${esc(a.mission)}</p>
    <div class="m"><b>Outils :</b> ${esc(a.tools.join(", "))}<br><b>Palier modèle :</b> ${esc(a.tier)} · <b>Limites :</b> ${esc(JSON.stringify(a.limits))}<br>
      <b>Critères de réussite :</b> ${esc(a.success.join(" ; "))}<br><b>Transmet à :</b> ${esc(a.handoff.join(", ") || "—")}
      ${a.skills.length ? `<br><b>Skills (mode Claude Code) :</b> ${esc(a.skills.join(", "))}` : ""}</div>
    <div class="m" style="margin-top:6px">LLM 30 j : ${fmt.num(a.llm_30d.calls)} appels · ${fmt.num(a.llm_30d.tokens)} tokens · ${fmt.usd(a.llm_30d.cost)} (estimé)</div>
    <div class="row" style="margin-top:8px">
      ${a.status === "active" ? `<button class="btn sm" data-ag="${a.id}" data-a="pause">⏸ Pause</button><button class="btn sm danger" data-ag="${a.id}" data-a="stop">■ Arrêter</button>`
        : `<button class="btn sm primary" data-ag="${a.id}" data-a="resume">▶ Reprendre</button>`}
      <button class="btn sm" data-ag="${a.id}" data-a="restart">↻ Relancer</button></div>
    ${a.last_jobs.length ? `<div class="list" style="margin-top:8px">${a.last_jobs.map((j) => `<div class="item"><code>${esc(j.type)}</code><span class="row">${badge(j.status)}<span class="m">${fmt.dt(j.updated_at)}</span></span></div>`).join("")}</div>` : ""}
  </div>`).join("")}</div>
  <div class="card" style="margin-top:16px"><h2>Journal des tâches</h2><div class="scroll"><table><tr><th>Tâche</th><th>Agent</th><th>Contenu</th><th>Statut</th><th>Essais</th><th>Maj</th><th>Erreur</th><th></th></tr>
    ${jobs.map((j) => `<tr><td><code>${esc(j.type)}</code></td><td>${esc(j.agent)}</td><td>${j.content_id ? `<a href="#/studio?c=${j.content_id}">${esc(j.content_id)}</a>` : "—"}</td>
      <td>${badge(j.status)}</td><td>${j.attempts}/${j.max_attempts}</td><td>${fmt.dt(j.updated_at)}</td><td class="m">${esc((j.last_error || "").slice(0, 120))}</td>
      <td>${["failed", "dead", "cancelled"].includes(j.status) ? `<button class="btn sm" data-job="${j.id}" data-ja="retry">Relancer</button>` : ["queued", "waiting"].includes(j.status) ? `<button class="btn sm" data-job="${j.id}" data-ja="cancel">Annuler</button>` : ""}</td></tr>`).join("")}</table></div></div>
  <div class="card" style="margin-top:16px"><h2>Runs</h2><table><tr><th>Run</th><th>Déclencheur</th><th>Début</th><th>Fin</th><th>Statut</th><th>Résumé</th></tr>
    ${runs.map((r) => `<tr><td><code>${esc(r.id)}</code></td><td>${esc(r.trigger)}</td><td>${fmt.dt(r.started_at)}</td><td>${fmt.dt(r.finished_at)}</td><td>${badge(r.status)}</td><td class="m">${esc(JSON.stringify(r.summary || {}))}</td></tr>`).join("")}</table></div>`;
  el.querySelectorAll("[data-ag]").forEach((b) => (b.onclick = async () => { await act(() => api(`/agents/${b.dataset.ag}/${b.dataset.a}`, { method: "POST" })); render(el); }));
  el.querySelectorAll("[data-job]").forEach((b) => (b.onclick = async () => { await act(() => api(`/jobs/${b.dataset.job}/${b.dataset.ja}`, { method: "POST" })); render(el); }));
}
