import { api, act, esc, fmt, prov } from "../app.js";
import { hbars, stat } from "../charts.js";

let month = new Date().toISOString().slice(0, 7);

export async function render(el) {
  const f = await api(`/finance?month=${month}`);
  el.innerHTML = `<div class="row between"><div><h1>Finance</h1><p class="sub">Revenus et dépenses saisis par vous ; coûts API estimés automatiquement d'après le tarif public.</p></div>
    <input type="month" id="m" value="${month}" style="width:auto"></div>
  <div class="grid g4">${stat("Revenus", fmt.eur(f.revenue), "", prov("manual"))}${stat("Dépenses", fmt.eur(f.expenses), "", prov("manual"))}
    ${stat("Net", fmt.eur(f.net), "revenus − dépenses saisis", prov("manual"))}${stat("Coût API Claude", fmt.usd(f.api_cost_usd_estimated), `budget ${fmt.usd(f.budget.monthly_usd)}/mois`, prov("estimated"))}</div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h2>Ajouter une ligne</h2><div class="grid g2"><div><label>Type</label><select id="k"><option value="expense">Dépense</option><option value="revenue">Revenu</option></select></div>
      <div><label>Montant (€)</label><input id="a" type="number" step="0.01" min="0"></div><div><label>Catégorie</label><input id="c" placeholder="abonnement, outil, sponsoring…"></div>
      <div><label>Date</label><input id="d" type="date" value="${new Date().toISOString().slice(0, 10)}"></div></div>
      <label>Note</label><input id="n"><button class="btn primary" id="add" style="margin-top:8px">Ajouter</button></div>
    <div class="card"><h2>Par catégorie</h2>${hbars(Object.entries(f.by_category).map(([k, v]) => ({ label: k.replace("revenue:", "↑ ").replace("expense:", "↓ "), value: v, display: fmt.eur(v) })))}</div>
  </div>
  <div class="card" style="margin-top:16px"><h2>Écritures ${esc(f.month)}</h2>${f.entries.length ? `<table><tr><th>Date</th><th>Type</th><th>Catégorie</th><th>Montant</th><th>Note</th><th></th></tr>
    ${f.entries.map((e) => `<tr><td>${esc(e.date)}</td><td>${e.kind === "revenue" ? "Revenu" : "Dépense"}</td><td>${esc(e.category)}</td><td>${fmt.eur(e.amount)}</td><td class="m">${esc(e.note || "")}</td>
      <td><button class="btn sm danger" data-del="${e.id}">✕</button></td></tr>`).join("")}</table>` : `<p class="empty">Aucune écriture ce mois-ci</p>`}</div>`;
  const $ = (s) => el.querySelector(s);
  $("#m").onchange = () => { month = $("#m").value; render(el); };
  $("#add").onclick = async () => {
    const r = await act(() => api("/finance", { method: "POST", body: { kind: $("#k").value, amount: parseFloat($("#a").value), category: $("#c").value, date: $("#d").value, note: $("#n").value } }), "Ajouté");
    if (r) render(el);
  };
  el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => { if (confirm("Supprimer ?")) { await act(() => api(`/finance/${b.dataset.del}`, { method: "DELETE" })); render(el); } }));
}
