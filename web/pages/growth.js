import { api, act, badge, esc, fmt, prov, safeUrl } from "../app.js";

let tab = "research";

export async function render(el) {
  const g = await api("/growth");
  const tabs = [["research", "Tendances & opportunités"], ["competitors", "Concurrents"], ["hooks", "Hooks & formats"], ["experiments", "Expériences"]];
  const body = {
    research: () => `<div class="card"><p class="m">Produit par l'agent Research à chaque run. Hors ligne : modèles génériques (pas des données). Une tendance « observée » cite sa source.</p>
      ${g.research.length ? `<div class="scroll"><table><tr><th>Type</th><th>Titre</th><th>Détail</th><th>Provenance</th><th>Date</th></tr>
      ${g.research.map((r) => `<tr><td>${esc(r.kind)}</td><td>${r.url ? `<a href="${safeUrl(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>` : esc(r.title)}</td>
        <td class="m">${esc((r.body || "").slice(0, 200))}</td><td>${prov(r.provenance)}</td><td>${fmt.date(r.created_at)}</td></tr>`).join("")}</table></div>` : `<p class="empty">Lancez l'agence pour alimenter la recherche.</p>`}</div>`,
    competitors: () => `<div class="card"><p class="m">Données publiques saisies manuellement (aucun scraping). L'agent Research n'en tire que des <b>patterns</b>, jamais de copie.</p>
      <div class="grid g4"><div><label>Plateforme</label><select id="cp"><option>tiktok</option><option>instagram</option></select></div><div><label>Compte (@)</label><input id="ch"></div>
        <div><label>Abonnés (si visible)</label><input id="cf" type="number"></div><div><label>Vues moyennes (estimation perso)</label><input id="cv" type="number"></div></div>
      <label>Notes : formats, hooks, rythme, ce qui marche</label><textarea id="cn"></textarea><button class="btn primary" id="cadd" style="margin-top:8px">Ajouter</button>
      <div class="scroll" style="margin-top:12px"><table><tr><th>Compte</th><th>Plateforme</th><th>Abonnés</th><th>Vues moy.</th><th>Notes</th><th></th></tr>
      ${g.competitors.map((c) => `<tr><td>${esc(c.handle)}</td><td>${esc(c.platform)}</td><td>${fmt.num(c.followers)} ${prov(c.provenance)}</td><td>${fmt.num(c.avg_views)}</td><td class="m">${esc(c.notes || "")}</td>
        <td><button class="btn sm danger" data-cdel="${c.id}">✕</button></td></tr>`).join("")}</table></div></div>`,
    hooks: () => `<div class="grid g2"><div class="card"><h2>Patterns de hooks</h2><div class="list">${g.hook_patterns.map((h) => `<div class="item"><span>${esc(h.pattern)}</span><span class="badge">${esc(h.type)}</span></div>`).join("")}</div></div>
      <div class="card"><h2>Formats qui fonctionnent (génériques)</h2><div class="list">${g.formats.map((f) => `<div class="item"><div><div class="t">${esc(f.name)}</div><div class="m">${esc(f.recipe)}</div></div><code>${esc(f.format)}</code></div>`).join("")}</div>
      <h2 style="margin-top:16px">Vos meilleurs contenus</h2>${g.top_contents.length ? `<table><tr><th>Hook</th><th>Format</th><th>Vues</th><th>ER</th></tr>${g.top_contents.map((t) => `<tr><td><a href="#/studio?c=${t.id}">${esc(t.hook)}</a></td><td>${esc(t.format)}</td><td>${fmt.num(t.views)}</td><td>${fmt.pct(t.er)} ${prov(t.provenance)}</td></tr>`).join("")}</table>` : `<p class="empty">Saisissez des statistiques pour classer vos hooks.</p>`}</div></div>`,
    experiments: () => `<div class="card"><p class="m">Une expérience A/B par run (une seule variable). Concluez-la quand vous avez assez de données.</p>
      ${g.experiments.length ? `<div class="scroll"><table><tr><th>Hypothèse</th><th>Variable</th><th>A / B</th><th>Métrique</th><th>Statut</th><th>Résultat</th></tr>
      ${g.experiments.map((x) => `<tr><td>${esc(x.hypothesis)}</td><td>${esc(x.variable)}</td><td>${esc(x.variant_a)} / ${esc(x.variant_b)}</td><td>${esc(x.metric)}</td>
        <td><select data-exp="${x.id}">${["proposed", "running", "concluded", "dropped"].map((s) => `<option ${s === x.status ? "selected" : ""}>${s}</option>`).join("")}</select></td>
        <td><input data-res="${x.id}" value="${esc(x.result || "")}" placeholder="conclusion chiffrée"></td></tr>`).join("")}</table></div>` : `<p class="empty">Aucune expérience</p>`}</div>`,
  };
  el.innerHTML = `<h1>Growth Center</h1><p class="sub">Analyse concurrentielle, tendances, hooks, formats, expériences — uniquement avec des données accessibles légalement.</p>
    <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? "on" : ""}">${l}</button>`).join("")}</div>${body[tab]()}`;
  el.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(el); }));
  const $ = (s) => el.querySelector(s);
  if ($("#cadd")) $("#cadd").onclick = async () => {
    const r = await act(() => api("/competitors", { method: "POST", body: { platform: $("#cp").value, handle: $("#ch").value, notes: $("#cn").value,
      followers: $("#cf").value ? +$("#cf").value : null, avg_views: $("#cv").value ? +$("#cv").value : null } }), "Ajouté");
    if (r) render(el);
  };
  el.querySelectorAll("[data-cdel]").forEach((b) => (b.onclick = async () => { await act(() => api(`/competitors/${b.dataset.cdel}`, { method: "DELETE" })); render(el); }));
  el.querySelectorAll("[data-exp]").forEach((s) => (s.onchange = () => act(() => api(`/experiments/${s.dataset.exp}`, { method: "PATCH", body: { status: s.value } }), "Statut mis à jour")));
  el.querySelectorAll("[data-res]").forEach((i) => (i.onchange = () => act(() => api(`/experiments/${i.dataset.res}`, { method: "PATCH", body: { result: i.value } }), "Résultat enregistré")));
  void badge;
}
