import { api, act, badge, esc, fmt, prov } from "../app.js";
import { stat } from "../charts.js";

export const poll = 4;
let contents = "";

export async function render(el) {
  const o = await api("/overview");
  const st = o.agency.status;
  const busy = o.run && o.run.status === "running";
  const activeAgents = o.agents.filter((a) => a.status === "active").length;
  const working = o.agents.filter((a) => a.running || a.queued).length;
  const inFlight = (o.jobs.running || 0) + (o.jobs.queued || 0) + (o.jobs.waiting || 0);
  const p = o.performance_7d, u = o.usage_30d;
  el.innerHTML = `
  <div class="hero card">
    <div><h1>Overview</h1>
      <p class="sub" style="margin:0">Agence ${badge(st === "running" ? "active" : st)} · run ${o.run ? `<code>${esc(o.run.id)}</code> ${badge(o.run.status)}` : "aucun"}
      · LLM <b>${esc(u.mode)}</b> ${u.budget.paid_calls_allowed ? `<span class="badge warn">! appels payants autorisés</span>` : `<span class="badge good">✓ aucune dépense</span>`}</p></div>
    <div class="row">
      <label class="check" style="margin:0">Contenus <input id="n" type="number" min="1" max="10" value="${esc(contents)}" placeholder="auto" style="width:72px"></label>
      <button class="launch" id="launch" ${busy ? "disabled" : ""}>${busy ? "RUN EN COURS…" : "LANCER L'AGENCE"}</button>
      ${st === "paused" ? `<button class="btn" data-a="resume">▶ Reprendre</button>` : `<button class="btn" data-a="pause" ${st === "stopped" ? "disabled" : ""}>⏸ Pause</button>`}
      <button class="btn danger" data-a="stop" ${st === "stopped" ? "disabled" : ""}>■ Arrêter</button>
    </div>
  </div>
  <div class="grid g4" style="margin-top:16px">
    ${stat("Agents actifs", `${activeAgents}/${o.agents.length}`, `${working} au travail`)}
    ${stat("Tâches en cours", fmt.num(inFlight), `${o.jobs.waiting || 0} en attente Claude Code · ${(o.jobs.failed || 0) + (o.jobs.dead || 0)} en échec`)}
    ${stat("Contenus produits", fmt.num(o.contents_total), `${o.contents.awaiting_approval || 0} à valider · ${o.contents.published || 0} publiés`)}
    ${stat("Publications prévues", fmt.num(o.upcoming.length), o.upcoming[0] ? `prochaine ${fmt.dt(o.upcoming[0].scheduled_at)}` : "aucune")}
    ${stat("Vues 7 jours", fmt.num(p.views), `${fmt.num(p.eng)} interactions · ${p.contents} contenus`, prov("manual"))}
    ${stat("Tokens 30 jours", fmt.num((u.input || 0) + (u.output || 0)), `${fmt.num(u.calls)} appels · cache lu ${fmt.num(u.cache_read)}`, prov("measured"))}
    ${stat("Coût API 30 jours", fmt.usd(u.cost), `budget ${fmt.usd(u.budget.daily_usd)}/j · ${fmt.usd(u.budget.monthly_usd)}/mois`, prov("estimated"))}
    ${stat("Tâches Claude Code", fmt.num(o.cc_pending), o.cc_pending ? "à traiter dans une session Claude Code" : "aucune en attente")}
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><div class="row between"><h2>Agents</h2><a href="#/agents">Gérer →</a></div>
      <div class="list">${o.agents.map((a) => `<div class="item"><div><div class="t">${esc(a.name)}</div><div class="m">${esc(a.roles.join(" · "))}</div></div>
        <div class="row">${a.running ? `<span class="badge info">⟳ ${a.running}</span>` : ""}${a.queued ? `<span class="badge">${a.queued} en file</span>` : ""}
        ${a.failed ? `<span class="badge crit">✕ ${a.failed}</span>` : ""}${badge(a.status)}</div></div>`).join("")}</div></div>
    <div class="grid">
      <div class="card"><h2>Tâches en cours</h2>${o.tasks.length ? `<div class="scroll"><table><tr><th>Tâche</th><th>Agent</th><th>Statut</th><th>Maj</th></tr>
        ${o.tasks.map((t) => `<tr><td><code>${esc(t.type)}</code></td><td>${esc(t.agent)}</td><td>${badge(t.status)}</td><td>${fmt.dt(t.updated_at)}</td></tr>`).join("")}</table></div>`
        : `<p class="empty">Aucune tâche en cours</p>`}</div>
      <div class="card"><h2>Publications prévues</h2>${o.upcoming.length ? `<div class="list">${o.upcoming.map((c) => `<div class="item"><a href="#/studio?c=${c.id}">${esc(c.title)}</a><span class="m">${esc(c.platform)} · ${fmt.dt(c.scheduled_at)}</span></div>`).join("")}</div>`
        : `<p class="empty">Rien de planifié</p>`}</div>
      <div class="card"><div class="row between"><h2>Alertes</h2>${o.alerts.length ? `<button class="btn sm" data-a="read">Tout marquer lu</button>` : ""}</div>
        ${o.alerts.length ? `<div class="list">${o.alerts.map((n) => `<div class="item"><div><div class="t">${badge(n.level === "error" ? "error" : n.level === "warn" ? "paused" : "new")} ${esc(n.title)}</div>
          <div class="m">${esc(n.body || "")}</div></div>${n.link ? `<a href="${esc(n.link)}">Ouvrir</a>` : ""}</div>`).join("")}</div>` : `<p class="empty">Aucune alerte</p>`}</div>
    </div>
  </div>
  <p class="sub" style="margin-top:16px">🔒 Garde-fous verrouillés : contenu adulte <b>désactivé</b> · validation humaine avant publication <b>obligatoire</b> · mention IA <b>obligatoire</b>.</p>`;

  el.querySelector("#n").oninput = (e) => { contents = e.target.value; };
  el.querySelector("#launch").onclick = async () => {
    const n = parseInt(contents, 10);
    await act(() => api("/agency/launch", { method: "POST", body: n ? { contents: n } : {} }), "Agence lancée 🚀");
    render(el);
  };
  el.querySelectorAll("[data-a]").forEach((b) => (b.onclick = async () => {
    const a = b.dataset.a;
    if (a === "stop" && !confirm("Arrêter l'agence ? Les tâches en file du run courant seront annulées.")) return;
    await act(() => (a === "read" ? api("/notifications/read", { method: "POST" }) : api(`/agency/${a}`, { method: "POST" })));
    render(el);
  }));
}
