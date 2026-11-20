import { api, act, esc, fmt, prov, toast } from "../app.js";
import { hbars, stat } from "../charts.js";

let month = new Date().toISOString().slice(0, 7);
let tab = "books";

const TABS = [["books", "Comptabilité"], ["deals", "Partenariats payants"], ["economics", "Rentabilité"], ["kit", "Kit média"]];

export async function render(el) {
  el.innerHTML = `<div class="row between"><div><h1>Finance</h1><p class="sub">Revenus/dépenses saisis par vous, deals de marques grand public, rentabilité par contenu, kit média. Coûts API estimés d'après le tarif public.</p></div></div>
    <div class="tabs">${TABS.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? "on" : ""}">${l}</button>`).join("")}</div><div id="tabc"></div>`;
  el.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(el); }));
  const box = el.querySelector("#tabc");
  await { books, deals, economics, kit }[tab](box, el);
}

async function books(box, el) {
  const f = await api(`/finance?month=${month}`);
  box.innerHTML = `<div class="row" style="justify-content:flex-end"><input type="month" id="m" value="${month}" style="width:auto"></div>
  <div class="grid g4" style="margin-top:8px">${stat("Revenus", fmt.eur(f.revenue), "", prov("manual"))}${stat("Dépenses", fmt.eur(f.expenses), "", prov("manual"))}
    ${stat("Net", fmt.eur(f.net), "revenus − dépenses saisis", prov("manual"))}${stat("Coût API Claude", fmt.usd(f.api_cost_usd_estimated), `budget ${fmt.usd(f.budget.monthly_usd)}/mois`, prov("estimated"))}</div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h2>Ajouter une ligne</h2><div class="grid g2"><div><label>Type</label><select id="k"><option value="expense">Dépense</option><option value="revenue">Revenu</option></select></div>
      <div><label>Montant (€)</label><input id="a" type="number" step="0.01" min="0"></div><div><label>Catégorie</label><input id="c" placeholder="abonnement, outil, partenariat…"></div>
      <div><label>Date</label><input id="d" type="date" value="${new Date().toISOString().slice(0, 10)}"></div></div>
      <label>Note</label><input id="n"><button class="btn primary" id="add" style="margin-top:8px">Ajouter</button></div>
    <div class="card"><h2>Par catégorie</h2>${hbars(Object.entries(f.by_category).map(([k, v]) => ({ label: k.replace("revenue:", "↑ ").replace("expense:", "↓ "), value: v, display: fmt.eur(v) })))}</div>
  </div>
  <div class="card" style="margin-top:16px"><h2>Écritures ${esc(f.month)}</h2>${f.entries.length ? `<table><tr><th>Date</th><th>Type</th><th>Catégorie</th><th>Montant</th><th>Note</th><th></th></tr>
    ${f.entries.map((e) => `<tr><td>${esc(e.date)}</td><td>${e.kind === "revenue" ? "Revenu" : "Dépense"}</td><td>${esc(e.category)}</td><td>${fmt.eur(e.amount)}</td><td class="m">${esc(e.note || "")}</td>
      <td><button class="btn sm danger" data-del="${e.id}">✕</button></td></tr>`).join("")}</table>` : `<p class="empty">Aucune écriture ce mois-ci</p>`}</div>`;
  const $ = (s) => box.querySelector(s);
  $("#m").onchange = () => { month = $("#m").value; render(el); };
  $("#add").onclick = async () => {
    const r = await act(() => api("/finance", { method: "POST", body: { kind: $("#k").value, amount: parseFloat($("#a").value), category: $("#c").value, date: $("#d").value, note: $("#n").value } }), "Ajouté");
    if (r) render(el);
  };
  box.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => { if (confirm("Supprimer ?")) { await act(() => api(`/finance/${b.dataset.del}`, { method: "DELETE" })); render(el); } }));
}

async function deals(box, el) {
  const list = (await api("/collabs")).filter((c) => c.kind === "brand");
  const pipe = list.filter((c) => !["declined"].includes(c.stage)).reduce((s, c) => s + (c.paid ? 0 : c.deal_value || 0), 0);
  const won = list.reduce((s, c) => s + (c.paid ? c.deal_value || 0 : 0), 0);
  box.innerHTML = `<div class="grid g3">${stat("Deals encaissés", fmt.eur(won), "", prov("manual"))}${stat("Pipeline non encaissé", fmt.eur(pipe), "deals en cours", prov("manual"))}
    ${stat("Marques", list.length, "ajoutez-les dans Growth Center › Partenariats")}</div>
  <p class="m" style="margin-top:12px">Chaque contenu sponsorisé reçoit automatiquement « Collaboration commerciale avec … » en tête de légende et en incrustation, plus « Image virtuelle » (loi n° 2023-451, à faire valider par un juriste).
    Catégories bloquées : chirurgie/injections esthétiques, nicotine/vape, crypto/trading, paris et jeux d'argent, médicaments…</p>
  <div class="card" style="margin-top:12px">${list.length ? `<div class="scroll"><table><tr><th>Marque</th><th>Étape</th><th>Montant (€)</th><th>Livrables</th><th>Échéance</th><th>Payé</th><th></th></tr>
    ${list.map((c) => `<tr><td><b>${esc(c.name)}</b><div class="m">${esc(c.platform || "")} ${esc(c.notes || "")}</div></td><td>${esc(c.stage)}</td>
      <td><input type="number" min="0" data-v="${c.id}" value="${c.deal_value ?? ""}" style="width:100px"></td><td><input type="number" min="1" max="20" data-n="${c.id}" value="${c.deliverables ?? ""}" style="width:70px"></td>
      <td><input type="date" data-d="${c.id}" value="${esc(c.due_date || "")}"></td><td>${c.paid ? `<span class="badge good">✓ payé</span>` : `<button class="btn sm" data-paid="${c.id}">Marquer payé</button>`}</td>
      <td><button class="btn sm" data-save="${c.id}">Enregistrer</button> ${["agreed", "done"].includes(c.stage) ? `<button class="btn sm primary" data-gen="${c.id}">Créer les contenus</button>` : `<span class="m">passer en « agreed »</span>`}</td></tr>`).join("")}</table></div>`
    : `<p class="empty">Aucune marque. Growth Center › Partenariats › type « Marque ».</p>`}</div>`;
  const q = (a, id) => box.querySelector(`[data-${a}="${id}"]`);
  box.querySelectorAll("[data-save]").forEach((b) => (b.onclick = async () => {
    const id = b.dataset.save;
    await act(() => api(`/collabs/${id}`, { method: "PATCH", body: { deal_value: q("v", id).value, deliverables: q("n", id).value, due_date: q("d", id).value || null } }), "Deal mis à jour");
    render(el);
  }));
  box.querySelectorAll("[data-gen]").forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    const r = await act(() => api(`/collabs/${b.dataset.gen}/deliverables`, { method: "POST" }));
    if (r) toast(`${r.created.length} contenu(s) sponsorisé(s) créé(s) : voir Generator pour les visuels`, 6000);
    render(el);
  }));
  box.querySelectorAll("[data-paid]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Confirmer l'encaissement ? Une ligne de revenu sera créée en Comptabilité.")) return;
    await act(() => api(`/collabs/${b.dataset.paid}/paid`, { method: "POST" }), "Revenu enregistré"); render(el);
  }));
}

async function economics(box) {
  const e = await api("/business/economics?days=90");
  const t = e.totals;
  const dim = (k) => hbars(Object.entries(e.by[k] || {}).map(([name, a]) => ({ label: name, value: a.revenue_eur, display: `${fmt.eur(a.revenue_eur)} · ${fmt.num(a.views)} vues · ${a.contents} contenus` })));
  box.innerHTML = `<div class="grid g4">${stat("Revenus 90 j", fmt.eur(t.revenue_eur), "", prov("manual"))}${stat("Dépenses 90 j", fmt.eur(t.expenses_eur), "", prov("manual"))}
    ${stat("Net 90 j", fmt.eur(t.net_eur), "", prov("manual"))}${stat("Dépenses / 1 000 vues", t.expenses_per_1k_views_eur != null ? fmt.eur(t.expenses_per_1k_views_eur) : "—", `${fmt.num(t.views)} vues mesurées · LLM ${fmt.usd(t.llm_cost_usd)}`, prov("estimated"))}</div>
  <div class="grid g2" style="margin-top:16px"><div class="card"><h2>Revenus par plateforme</h2>${dim("platform")}</div><div class="card"><h2>Revenus par pilier</h2>${dim("pillar")}</div></div>
  <div class="card" style="margin-top:16px"><h2>Par contenu</h2><div class="scroll"><table><tr><th>Contenu</th><th>Plateforme</th><th>Vues</th><th>Revenu</th><th>€ / 1 000 vues</th><th>Coût LLM</th></tr>
    ${e.contents.map((c) => `<tr><td><a href="#/studio?c=${c.id}">${esc(c.title)}</a>${c.deal_id ? ` <span class="badge">sponsorisé</span>` : ""}</td><td>${esc(c.platform)}</td><td>${fmt.num(c.views)}</td>
      <td>${fmt.eur(c.revenue_eur)}</td><td>${c.rev_per_1k_views != null ? fmt.eur(c.rev_per_1k_views) : "—"}</td><td>${fmt.usd(c.llm_cost_usd)}</td></tr>`).join("")}</table></div>
    <p class="m">Revenu d'un deal réparti à parts égales entre ses livrables. Coût LLM = tokens mesurés × tarif public (estimé).</p></div>`;
}

async function kit(box, el) {
  const [k, s] = await Promise.all([api("/business/media-kit"), api("/settings")]);
  const cpm = s.settings.cpm_eur || {};
  box.innerHTML = `<div class="grid g2"><div class="card"><h2>${esc(k.name)}</h2><p><i>${esc(k.tagline)}</i></p><p>${esc(k.bio)}</p><p class="m">${esc(k.disclosure)}</p>
      <table><tr><th>Plateforme</th><th>Abonnés</th><th>Vues moy. (10)</th><th>Engagement</th></tr>${k.platforms.map((p) => `<tr><td>${esc(p.platform)} ${esc(p.handle)}</td>
        <td>${fmt.num(p.followers)} ${prov("manual")}</td><td>${fmt.num(p.avg_views_last10)}</td><td>${fmt.pct(p.avg_er_last10)}</td></tr>`).join("")}</table></div>
    <div class="card"><h2>Grille tarifaire</h2><p class="m">Prix = vos vues moyennes × <b>votre</b> CPM (€ pour 1 000 vues). Aucun tarif « marché » inventé : fixez votre fourchette.</p>
      <div class="grid g2"><div><label>CPM bas (€)</label><input type="number" min="1" id="lo" value="${cpm.low ?? ""}"></div><div><label>CPM haut (€)</label><input type="number" min="1" id="hi" value="${cpm.high ?? ""}"></div></div>
      <button class="btn" id="cpm" style="margin-top:8px">Enregistrer le CPM</button>
      ${k.rate_card.length ? `<table style="margin-top:8px">${k.rate_card.map((r) => `<tr><td>${esc(r.platform)} · ${esc(r.deliverable)}</td><td><b>${fmt.eur(r.low_eur)} – ${fmt.eur(r.high_eur)}</b> ${prov("estimated")}</td></tr>`).join("")}</table>` : `<p class="empty">${esc(k.rate_card_note)}</p>`}
      <button class="btn primary" id="exp" style="margin-top:12px">Exporter le kit média (Markdown)</button><div id="md" class="pre" style="margin-top:8px" hidden></div></div></div>`;
  box.querySelector("#cpm").onclick = async () => {
    const lo = box.querySelector("#lo").value, hi = box.querySelector("#hi").value;
    if (await act(() => api("/settings", { method: "PUT", body: { cpm_eur: { low: lo ? +lo : null, high: hi ? +hi : null } } }), "CPM enregistré")) render(el);
  };
  box.querySelector("#exp").onclick = async () => {
    const r = await act(() => api("/business/media-kit/export", { method: "POST" }), "Kit exporté dans briefs/");
    if (r) { const md = box.querySelector("#md"); md.hidden = false; md.textContent = r.markdown; }
  };
}
