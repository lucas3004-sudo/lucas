import { api, act, esc, fmt, prov } from "../app.js";
import { bars, stat, wire } from "../charts.js";

export async function render(el) {
  const u = await api("/usage?days=30");
  const t = u.totals;
  const table = (rows, label) => rows.length ? `<div class="scroll"><table><tr><th>${label}</th><th>Fournisseur</th><th>Appels</th><th>Tokens entrée</th><th>Tokens sortie</th><th>Coût</th><th>Prov.</th></tr>
    ${rows.map((r) => `<tr><td>${esc(r.k || "—")}</td><td>${esc(r.provider)}</td><td>${fmt.num(r.calls)}</td><td>${fmt.num(r.input)}</td><td>${fmt.num(r.output)}</td><td>${fmt.usd(r.cost)}</td><td>${prov(r.prov)}</td></tr>`).join("")}</table></div>`
    : `<p class="empty">Aucun appel</p>`;
  el.innerHTML = `<h1>Token & Usage</h1><p class="sub">Mesuré = chiffres renvoyés par l'API ou les journaux Claude Code. Estimé = calculé (tarif public du ${esc(u.prices_as_of)}, ou 3,5 caractères/token). Jamais présenté comme une facture.</p>
  <div class="grid g4">${stat("Appels LLM (30 j)", fmt.num(t.calls), `mode actuel : ${esc(u.mode)}`)}${stat("Tokens entrée / sortie", `${fmt.num(t.input)} / ${fmt.num(t.output)}`, `cache lu ${fmt.num(t.cache_read)} · écrit ${fmt.num(t.cache_write)}`, prov("measured"))}
    ${stat("Coût API", fmt.usd(t.cost), `plafonds : ${fmt.usd(u.budget.daily_usd)}/j · ${fmt.usd(u.budget.monthly_usd)}/mois`, prov("estimated"))}
    ${stat("Appels payants", u.budget.paid_calls_allowed ? "autorisés" : "bloqués", u.budget.paid_calls_allowed ? "plafond bloquant actif" : "aucune dépense possible")}</div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h2>Tokens par jour</h2>${bars(u.daily.map((d) => ({ label: d.day.slice(5), value: d.tokens || 0, tip: `${d.day} : ${fmt.num(d.tokens)} tokens, ${d.calls} appels, ${fmt.usd(d.cost)}` })), { title: "Tokens par jour" })}</div>
    <div class="card"><h2>Pistes d'optimisation</h2><ul>${u.suggestions.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      <h3>Bonnes pratiques Claude Code (abonnement Pro)</h3><ul class="m">
        <li><code>/usage</code> : voir votre consommation du forfait ; <code>/cost</code> : coût de la session (indicatif)</li>
        <li><code>/compact</code> entre deux phases d'une même tâche ; <code>/clear</code> entre deux tâches sans rapport</li>
        <li>Mode <b>claude_code</b> : les agents écrivent des tâches courtes que vous traitez avec <code>/agency-run-tasks</code> (une session = un lot)</li>
        <li>Skills chargés à la demande : seules leurs descriptions (≈ 600 tokens) sont lues à chaque session</li></ul></div></div>
  <div class="grid g2" style="margin-top:16px"><div class="card"><h2>Agents les plus consommateurs</h2>${table(u.by_agent, "Agent")}</div><div class="card"><h2>Tâches les plus coûteuses</h2>${table(u.by_task, "Tâche")}</div></div>
  <div class="card" style="margin-top:16px"><h2>Par modèle</h2>${table(u.by_model, "Modèle")}</div>
  <div class="card" style="margin-top:16px"><div class="row between"><h2>Sessions Claude Code</h2><button class="btn sm" id="imp">Importer les journaux locaux</button></div>
    <p class="m">Lit <code>~/.claude/projects/*/*.jsonl</code> sur la machine qui exécute l'OS (tokens mesurés). « Équivalent API » = ce que ces tokens coûteraient via l'API : ce n'est pas votre facture Pro.</p>
    ${u.claude_code_sessions.length ? `<div class="scroll"><table><tr><th>Session</th><th>Modèle</th><th>Messages</th><th>Entrée</th><th>Cache lu</th><th>Sortie</th><th>Équivalent API</th><th>Dernière activité</th></tr>
    ${u.claude_code_sessions.map((s) => `<tr><td><code>${esc(String(s.session_id).slice(0, 8))}</code></td><td>${esc(s.model)}</td><td>${s.messages}</td><td>${fmt.num(s.input)}</td><td>${fmt.num(s.cache_read)}</td><td>${fmt.num(s.output)}</td>
      <td>${fmt.usd(s.api_equivalent_usd)} ${prov("estimated")}</td><td>${fmt.dt(s.last)}</td></tr>`).join("")}</table></div>` : `<p class="empty">Aucune session importée</p>`}</div>
  <div class="card" style="margin-top:16px"><h2>APIs externes</h2>${u.external_apis.length ? `<table><tr><th>Service</th><th>Opération</th><th>Volume</th><th>Prov.</th></tr>${u.external_apis.map((x) => `<tr><td>${esc(x.service)}</td><td>${esc(x.operation)}</td><td>${fmt.num(x.units)} ${esc(x.unit)}</td><td>${prov(x.provenance)}</td></tr>`).join("")}</table>` : `<p class="empty">Aucun appel externe</p>`}</div>`;
  wire(el);
  el.querySelector("#imp").onclick = async () => { const r = await act(() => api("/usage/import-claude-code", { method: "POST", body: {} })); if (r) { alert(`${r.imported} message(s) importé(s) depuis ${r.files} fichier(s)${r.note ? ` — ${r.note}` : ""}`); render(el); } };
}
