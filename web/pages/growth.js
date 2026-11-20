import { api, act, badge, esc, fmt, prov, safeUrl, toast } from "../app.js";
import { hbars } from "../charts.js";

let tab = "intel";
const STAGES = ["prospect", "contacted", "discussion", "agreed", "done", "declined"];

export async function render(el) {
  const g = await api("/growth");
  const intel = tab === "intel" ? await api("/growth/intel") : null;
  const series = tab === "series" ? await api("/series") : [];
  const collabs = tab === "collabs" ? await api("/collabs") : [];
  const tabs = [["intel", "Intelligence"], ["research", "Tendances & opportunités"], ["competitors", "Concurrents"], ["hooks", "Hooks & formats"],
    ["experiments", "Expériences A/B"], ["series", "Séries"], ["collabs", "Partenariats"]];
  const arms = (d) => hbars(Object.entries(d).sort((a, b) => b[1].posterior_mean - a[1].posterior_mean)
    .map(([k, v]) => ({ label: k, value: v.posterior_mean, display: `${Math.round(v.posterior_mean * 100)} % · ${v.wins}/${v.wins + v.losses}` })));
  const body = {
    intel: () => `<p class="m">${esc(intel.note)} Le bandit répartit chaque run : il exploite ce qui marche et continue d'explorer le reste.</p>
      ${intel.anomalies.length ? `<div class="card" style="border-color:var(--warning)"><h2>Alertes</h2>${intel.anomalies.map((a) => `<p><b>${esc(a.title)}</b> — ${esc(a.body)}</p>`).join("")}</div>` : ""}
      <div class="grid g2" style="margin-top:12px">
        <div class="card"><h2>Gagnants à décliner (suite auto)</h2>${intel.winners.length ? `<div class="list">${intel.winners.map((w) => `<div class="item"><a href="#/studio?c=${w.id}">${esc(w.title)}</a><span class="badge good">×${w.perf_index}</span></div>`).join("")}</div>` : `<p class="empty">Aucun gagnant au-dessus du seuil pour l'instant</p>`}
          <h2 style="margin-top:16px">Besoin de production (quotas, 3 jours)</h2>${intel.deficit ? hbars(Object.entries(intel.deficit).map(([k, v]) => ({ label: k, value: v, display: `${v} contenu(s)` }))) : `<p class="m">Ajoutez vos comptes (page Comptes) pour piloter la production par quotas.</p>`}</div>
        <div class="card"><h2>Bandit : piliers</h2>${arms(intel.arms.pillars) || ""}<h2 style="margin-top:16px">Bandit : formats</h2>${arms(intel.arms.formats) || ""}
          <p class="m">% = probabilité moyenne de dépasser la médiane de la plateforme (a priori 50 % sans donnée).</p></div>
        <div class="card"><h2>Meilleurs créneaux</h2>${Object.entries(intel.slots).map(([p, sl]) => `<p><b>${esc(p)}</b> : ${sl.length ? sl.slice(0, 3).map((x) => `${x.slot} (×${x.avg_index}, n=${x.n})`).join(" · ") : `<span class="m">données insuffisantes (≥ 3 contenus par tranche)</span>`}</p>`).join("")}</div>
        <div class="card"><h2>Objectifs</h2>${intel.targets.length ? intel.targets.map((t) => `<p>${esc(t.metric)} ${esc(t.handle || "global")} : ${fmt.num(t.current)} / ${fmt.num(t.target)} ${t.forecast ? `→ projection ${fmt.num(t.forecast.projected)} ${prov("forecast")}` : ""}</p>`).join("") : `<p class="empty"><a href="#/accounts">Fixer des objectifs</a></p>`}</div>
      </div>
      <div class="card" style="margin-top:16px"><h2>Performance par contenu</h2>${intel.performance.length ? `<div class="scroll"><table><tr><th>Contenu</th><th>Plateforme</th><th>Format</th><th>Hook</th><th>Vues</th><th>ER</th><th>Indice</th><th>Rétention</th></tr>
        ${intel.performance.map((p) => `<tr><td><a href="#/studio?c=${p.id}">${esc(p.title)}</a></td><td>${esc(p.platform)}</td><td>${esc(p.format)}</td><td>${esc(p.hook_type || "—")}</td><td>${fmt.num(p.views)} ${prov(p.provenance)}</td>
          <td>${fmt.pct(p.er)}</td><td>${p.perf_index != null ? `<b>×${p.perf_index}</b>` : "—"}</td><td class="m">${p.avg_watch_s != null ? `${p.avg_watch_s} s` : ""} ${p.completion_rate != null ? fmt.pct(p.completion_rate) : ""}</td></tr>`).join("")}</table></div>`
        : `<p class="empty">Saisissez les statistiques de vos contenus publiés (Content Studio ou Analytics).</p>`}</div>`,
    series: () => `<div class="card"><p class="m">Les séries fidélisent (les gens reviennent pour l'épisode suivant). L'agence place au plus un épisode par série active à chaque run.</p>
      <div class="grid g4"><div><label>Nom</label><input id="sn" placeholder="Les galères de Nour"></div><div><label>Pilier (optionnel)</label><input id="sp"></div>
        <div><label>Plateforme (optionnel)</label><select id="spl"><option value="">toutes</option><option>tiktok</option><option>instagram</option></select></div><div><label>Concept</label><input id="spr" placeholder="une galère étudiante par épisode"></div></div>
      <button class="btn primary" id="sadd" style="margin-top:8px">Créer la série</button>
      <table style="margin-top:12px"><tr><th>Série</th><th>Pilier</th><th>Épisodes</th><th>Statut</th></tr>${series.map((x) => `<tr><td><b>${esc(x.name)}</b><div class="m">${esc(x.premise || "")}</div></td><td>${esc(x.pillar || "tous")}</td><td>${x.episodes}</td>
        <td><select data-ser="${x.id}">${["active", "paused", "ended"].map((st) => `<option ${st === x.status ? "selected" : ""}>${st}</option>`).join("")}</select></td></tr>`).join("")}</table></div>`,
    collabs: () => `<div class="card"><p class="m">Acquisition par partenariats : duos/réponses vidéo avec des créateurs de la niche, marques grand public, médias. Les messages sont des brouillons : c'est vous qui envoyez. Aucun partenariat adulte.</p>
      <div class="grid g4"><div><label>Type</label><select id="ck"><option value="creator">Créateur</option><option value="brand">Marque</option><option value="media">Média</option><option value="engage">Compte à engager</option></select></div>
        <div><label>Nom</label><input id="cn2"></div><div><label>Plateforme / @</label><input id="ch2" placeholder="tiktok @compte"></div><div><label>Affinité (1-10)</label><input id="cf2" type="number" min="1" max="10"></div></div>
      <button class="btn primary" id="cadd2" style="margin-top:8px">Ajouter</button></div>
      <div class="kanban" style="margin-top:12px">${STAGES.map((st) => `<div class="col"><h3>${st}<span class="badge">${collabs.filter((c) => c.stage === st).length}</span></h3>${collabs.filter((c) => c.stage === st).map((c) => `<div class="card flat">
        <div class="t">${esc(c.name)}</div><div class="m">${esc(c.kind)} · ${esc(c.platform || "")} ${esc(c.handle || "")} ${c.fit_score ? `· affinité ${c.fit_score}` : ""}</div>
        <select data-cst="${c.id}" style="margin-top:6px">${STAGES.map((s2) => `<option ${s2 === c.stage ? "selected" : ""}>${s2}</option>`).join("")}</select>
        ${c.draft_message ? `<div class="pre m" style="margin-top:6px">${esc(c.draft_message)}</div><button class="btn sm" data-ccopy="${c.id}">Copier</button>` : ""}
        <button class="btn sm" data-cdraft="${c.id}" style="margin-top:6px">${c.draft_message ? "Régénérer" : "Rédiger"} le message</button></div>`).join("")}</div>`).join("")}</div>`,
    research: () => `<div class="card"><p class="m">Produit par l'agent Research à chaque run. Hors ligne : modèles génériques (pas des données). Une tendance « observée » cite sa source.</p>
      ${g.research.length ? `<div class="scroll"><table><tr><th>Type</th><th>Titre</th><th>Détail</th><th>Provenance</th><th>Date</th></tr>
      ${g.research.map((r) => `<tr><td>${esc(r.kind)}</td><td>${r.url ? `<a href="${safeUrl(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>` : esc(r.title)}</td>
        <td class="m">${esc((r.body || "").slice(0, 200))}</td><td>${prov(r.provenance)}</td><td>${fmt.date(r.created_at)}</td></tr>`).join("")}</table></div>` : `<p class="empty">Lancez l'agence pour alimenter la recherche.</p>`}</div>`,
    competitors: () => `<div class="card"><p class="m">Données publiques saisies manuellement (aucun scraping). L'agent Research n'en tire que des <b>patterns</b>, jamais de copie.</p>
      <div class="grid g4"><div><label>Plateforme</label><select id="cp"><option>tiktok</option><option>instagram</option><option>youtube</option><option>snapchat</option></select></div><div><label>Compte (@)</label><input id="ch"></div>
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
        <td><input data-res="${x.id}" value="${esc(x.result || "")}" placeholder="conclusion chiffrée">${x.status === "running" ? `<button class="btn sm" data-eval="${x.id}" style="margin-top:4px">Évaluer maintenant</button><div class="m" id="ev-${x.id}"></div>` : ""}</td></tr>`).join("")}</table></div>` : `<p class="empty">Aucune expérience</p>`}
      <p class="m">Méthode : bêta-binomiale sur interactions/vues, probabilité P(B&gt;A) par Monte-Carlo ; conclusion à 95 % seulement, avec un minimum de vues par variante (Settings).</p></div>`,
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
  el.querySelectorAll("[data-eval]").forEach((b) => (b.onclick = async () => {
    const r = await act(() => api(`/experiments/${b.dataset.eval}/evaluate`));
    if (r) { const e = r.evaluation; el.querySelector(`#ev-${b.dataset.eval}`).textContent = `${e.decision} · A ${fmt.pct(e.A.er)} (${e.A.views} vues) · B ${fmt.pct(e.B.er)} (${e.B.views} vues)${e.p_b_better != null ? ` · P(B>A) ${fmt.pct(e.p_b_better)}` : ""}`; }
  }));
  if ($("#sadd")) $("#sadd").onclick = async () => { if (await act(() => api("/series", { method: "POST", body: { name: $("#sn").value, pillar: $("#sp").value, platform: $("#spl").value, premise: $("#spr").value } }), "Série créée")) render(el); };
  el.querySelectorAll("[data-ser]").forEach((x) => (x.onchange = () => act(() => api(`/series/${x.dataset.ser}`, { method: "PATCH", body: { status: x.value } }), "Série mise à jour")));
  if ($("#cadd2")) $("#cadd2").onclick = async () => {
    const [platform, handle] = $("#ch2").value.trim().split(/\s+/);
    if (await act(() => api("/collabs", { method: "POST", body: { kind: $("#ck").value, name: $("#cn2").value, platform: platform || null, handle: handle || null, fit_score: $("#cf2").value ? +$("#cf2").value : null } }), "Ajouté")) render(el);
  };
  el.querySelectorAll("[data-cst]").forEach((x) => (x.onchange = async () => { await act(() => api(`/collabs/${x.dataset.cst}`, { method: "PATCH", body: { stage: x.value } })); render(el); }));
  el.querySelectorAll("[data-cdraft]").forEach((b) => (b.onclick = async () => { b.disabled = true; await act(() => api(`/collabs/${b.dataset.cdraft}/draft`, { method: "POST" }), "Brouillon prêt"); render(el); }));
  el.querySelectorAll("[data-ccopy]").forEach((b) => (b.onclick = () => navigator.clipboard.writeText(collabs.find((c) => c.id === b.dataset.ccopy).draft_message).then(() => toast("Copié"), () => toast("Copie impossible"))));
  void badge;
}
