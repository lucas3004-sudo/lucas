import { api, act, esc, fmt, prov } from "../app.js";
import { bars, hbars, stat, wire } from "../charts.js";

export async function render(el) {
  const [a, contents] = await Promise.all([api("/analytics"), api("/contents?status=published")]);
  const t = a.totals;
  const er = t.views ? (t.likes + t.comments + t.shares + t.saves) / t.views : null;
  const hb = (rows) => hbars(rows.filter((r) => r.k).map((r) => ({ label: r.k, value: r.views || 0, display: `${fmt.num(r.views)} vues · ER ${fmt.pct(r.views ? r.eng / r.views : null)}` })));
  el.innerHTML = `<h1>Analytics</h1><p class="sub">${esc(a.provenance_note)} Chaque chiffre affiche sa provenance.</p>
  <div class="grid g4">${stat("Vues", fmt.num(t.views), `${t.n} relevés`, prov("manual"))}${stat("Taux d'engagement", fmt.pct(er), "(likes+comm.+partages+enreg.) / vues", prov("manual"))}
    ${stat("Commentaires", fmt.num(t.comments), `${fmt.num(t.shares)} partages · ${fmt.num(t.saves)} enregistrements`, prov("manual"))}${stat("Abonnés gagnés", fmt.num(t.followers), "somme des deltas saisis", prov("manual"))}</div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h2>Vues par jour</h2>${bars(a.series.map((s) => ({ label: s.date.slice(5), value: s.views || 0, tip: `${s.date} : ${fmt.num(s.views)} vues, ${fmt.num(s.eng)} interactions` })), { title: "Vues par jour" })}</div>
    <div class="card"><h2>Par format</h2>${hb(a.by_format)}<h2 style="margin-top:16px">Par pilier</h2>${hb(a.by_pillar)}<h2 style="margin-top:16px">Par plateforme</h2>${hb(a.by_platform)}</div>
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h2>Saisir des statistiques</h2><div class="grid g2"><div><label>Contenu publié</label><select id="cid"><option value="">— compte global —</option>${contents.map((c) => `<option value="${c.id}" data-p="${c.platform}">${esc(c.title)}</option>`).join("")}</select></div>
      <div><label>Plateforme</label><select id="pl"><option>instagram</option><option>tiktok</option><option>youtube</option><option>snapchat</option></select></div></div>
      <div class="grid g3"><div><label>Date</label><input type="date" id="date" value="${new Date().toISOString().slice(0, 10)}"></div>${["views", "likes", "comments", "shares", "saves", "followers_delta", "avg_watch_s"].map((k) => `<div><label>${k}</label><input type="number" min="0" step="any" data-m="${k}"></div>`).join("")}
      <div><label>Taux de complétion (%)</label><input type="number" min="0" max="100" step="any" id="compl"></div></div>
      <p class="m">Durée moyenne de visionnage et complétion : dans les statistiques natives de chaque vidéo. Ce sont les signaux de rétention les plus prédictifs.</p>
      <button class="btn primary" id="add" style="margin-top:8px">Enregistrer</button></div>
    <div class="card"><h2>Apprentissages (Analyst)</h2>${a.insights.length ? `<div class="list">${a.insights.map((i) => `<div class="item"><div><div class="t">${esc(i.title)}</div><div class="m">${esc(i.body)}</div></div>${prov(i.provenance)}</div>`).join("")}</div>`
      : `<p class="empty">Il faut au moins 3 contenus mesurés pour tirer un enseignement (aucun chiffre inventé).</p>`}</div>
  </div>
  <div class="card" style="margin-top:16px"><h2>Derniers relevés</h2><div class="scroll"><table><tr><th>Date</th><th>Contenu</th><th>Plateforme</th><th>Vues</th><th>Likes</th><th>Comm.</th><th>Partages</th><th>Enreg.</th><th>Prov.</th></tr>
    ${a.contents.map((m) => `<tr><td>${esc(m.date)}</td><td>${m.content_id ? `<a href="#/studio?c=${m.content_id}">${esc(m.title || m.content_id)}</a>` : "global"}</td><td>${esc(m.platform)}</td>
      <td>${fmt.num(m.views)}</td><td>${fmt.num(m.likes)}</td><td>${fmt.num(m.comments)}</td><td>${fmt.num(m.shares)}</td><td>${fmt.num(m.saves)}</td><td>${prov(m.provenance)}</td></tr>`).join("")}</table></div></div>`;
  wire(el);
  const $ = (s) => el.querySelector(s);
  $("#cid").onchange = () => { const o = $("#cid").selectedOptions[0]; if (o.dataset.p) $("#pl").value = o.dataset.p; };
  $("#add").onclick = async () => {
    const body = { content_id: $("#cid").value || null, platform: $("#pl").value, date: $("#date").value };
    el.querySelectorAll("[data-m]").forEach((i) => { if (i.value !== "") body[i.dataset.m] = parseFloat(i.value); });
    if ($("#compl").value !== "") body.completion_rate = parseFloat($("#compl").value) / 100;
    if (await act(() => api("/metrics", { method: "POST", body }), "Enregistré")) render(el);
  };
}
