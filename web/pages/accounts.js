import { api, act, badge, esc, fmt, prov, toast } from "../app.js";

const PL = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube Shorts", snapchat: "Snapchat Spotlight" };
const METRICS = { followers: "Abonnés", views_week: "Vues / 7 j", er: "Taux d'engagement", posts_week: "Publications / 7 j" };

export async function render(el) {
  const [accs, targets] = await Promise.all([api("/accounts"), api("/targets")]);
  el.innerHTML = `<h1>Comptes</h1><p class="sub">Un compte officiel par plateforme grand public. Quotas de publication, santé, avertissements, mention IA dans la bio et objectifs.
    <b>Pas de multi-comptes ni d'automatisation de publication</b> : c'est ce qui fait bannir.</p>
  <div class="grid g2">${accs.map((a) => `<div class="card">
    <div class="row between"><div><h2 style="margin:0">${esc(PL[a.platform] || a.platform)} · ${esc(a.handle)}</h2>
      <div class="m">${fmt.num(a.followers)} abonnés ${prov("manual")} · ${a.published_7d} publication(s) / 7 j · ${a.scheduled} planifiée(s) · dernière ${fmt.dt(a.last_published)}</div></div>
      ${badge(a.status === "restricted" ? "error" : a.status)}</div>
    <div class="grid g3" style="margin-top:8px">
      <div><label>Statut</label><select data-st="${a.id}">${["active", "paused", "restricted"].map((s) => `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      <div><label>Quota / jour</label><input type="number" min="0" max="5" data-q="${a.id}" value="${a.daily_quota}"></div>
      <div><label>Abonnés (relevé du jour)</label><input type="number" min="0" data-f="${a.id}" placeholder="${a.followers ?? ""}"></div></div>
    <label>Bio ${a.bio_has_disclosure ? `<span class="badge good">✓ mention IA</span>` : `<span class="badge crit">✕ mention IA absente</span>`}</label>
    <div class="row"><input data-bio="${a.id}" value="${esc(a.bio || "")}" style="flex:1">${a.bio_has_disclosure ? "" : `<button class="btn sm" data-sugg="${a.id}" data-text="${esc(a.suggested_bio)}">Ajouter « ${esc(a.suggested_bio)} »</button>`}</div>
    <div class="row" style="margin-top:8px"><button class="btn sm primary" data-save="${a.id}">Enregistrer</button>
      <button class="btn sm" data-warn="${a.id}">+ Avertissement plateforme</button><button class="btn sm danger" data-del="${a.id}">Supprimer</button></div>
    ${a.events.filter((e) => e.kind !== "followers").length ? `<div class="list" style="margin-top:8px">${a.events.filter((e) => e.kind !== "followers").map((e) => `<div class="item"><span>${esc(e.kind)} · ${esc(e.details || "")}</span><span class="m">${fmt.dt(e.at)}</span></div>`).join("")}</div>` : ""}
  </div>`).join("") || `<div class="card"><p class="empty">Aucun compte. Ajoutez vos comptes officiels pour activer les quotas, la répartition et la veille de santé.</p></div>`}</div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h2>Ajouter un compte</h2><div class="grid g2"><div><label>Plateforme</label><select id="np">${Object.entries(PL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
      <div><label>Identifiant (@)</label><input id="nh"></div><div><label>Quota / jour</label><input id="nq" type="number" value="1" min="0" max="5"></div><div><label>Abonnés actuels</label><input id="nf" type="number" min="0"></div></div>
      <button class="btn primary" id="add" style="margin-top:8px">Ajouter</button>
      <p class="m">Les comptes YouTube/Snapchat reçoivent les déclinaisons des vidéos validées (Settings › crosspost).</p></div>
    <div class="card"><h2>Objectifs</h2>${targets.length ? `<table><tr><th>Objectif</th><th>Actuel</th><th>Progression</th><th>Projection</th><th></th></tr>${targets.map((t) => `<tr>
      <td>${esc(METRICS[t.metric])} ${esc(t.handle || "global")} → <b>${fmt.num(t.target)}</b> avant ${esc(t.deadline)}</td><td>${fmt.num(t.current)} ${prov(t.current_provenance)}</td>
      <td>${t.progress != null ? fmt.pct(t.progress) : "—"}</td><td>${t.forecast ? `${fmt.num(t.forecast.projected)} ${prov("forecast")} ${t.on_track ? `<span class="badge good">✓ en route</span>` : `<span class="badge crit">✕ en retard</span>`}` : `<span class="m">≥ 3 relevés nécessaires</span>`}</td>
      <td><button class="btn sm danger" data-tdel="${t.id}">✕</button></td></tr>`).join("")}</table>` : `<p class="empty">Aucun objectif</p>`}
      <div class="grid g4" style="margin-top:8px"><div><label>Compte</label><select id="ta"><option value="">global</option>${accs.map((a) => `<option value="${a.id}">${esc(a.handle)}</option>`).join("")}</select></div>
        <div><label>Métrique</label><select id="tm">${Object.entries(METRICS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
        <div><label>Cible</label><input id="tv" type="number" step="any"></div><div><label>Échéance</label><input id="td" type="date"></div></div>
      <button class="btn" id="tadd" style="margin-top:8px">Ajouter l'objectif</button></div>
  </div>`;
  const $ = (s) => el.querySelector(s);
  const q = (attr, id) => el.querySelector(`[data-${attr}="${id}"]`);
  el.querySelectorAll("[data-save]").forEach((b) => (b.onclick = async () => {
    const id = b.dataset.save;
    await act(() => api(`/accounts/${id}`, { method: "PATCH", body: { status: q("st", id).value, daily_quota: +q("q", id).value, bio: q("bio", id).value } }), "Compte mis à jour");
    if (q("f", id).value) await act(() => api(`/accounts/${id}/events`, { method: "POST", body: { kind: "followers", value: +q("f", id).value } }), "Relevé d'abonnés enregistré");
    render(el);
  }));
  el.querySelectorAll("[data-sugg]").forEach((b) => (b.onclick = () => { const i = q("bio", b.dataset.sugg); i.value = `${i.value} ${b.dataset.text}`.trim(); toast("Cliquez Enregistrer, puis copiez la bio sur la plateforme."); }));
  el.querySelectorAll("[data-warn]").forEach((b) => (b.onclick = async () => {
    const d = prompt("Avertissement reçu (texte / motif) :"); if (!d) return;
    await act(() => api(`/accounts/${b.dataset.warn}/events`, { method: "POST", body: { kind: "warning", details: d } }), "Avertissement consigné"); render(el);
  }));
  el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => { if (confirm("Supprimer ce compte de l'OS (pas de la plateforme) ?")) { await act(() => api(`/accounts/${b.dataset.del}`, { method: "DELETE" })); render(el); } }));
  el.querySelectorAll("[data-tdel]").forEach((b) => (b.onclick = async () => { await act(() => api(`/targets/${b.dataset.tdel}`, { method: "DELETE" })); render(el); }));
  $("#add").onclick = async () => {
    const r = await act(() => api("/accounts", { method: "POST", body: { platform: $("#np").value, handle: $("#nh").value, daily_quota: +$("#nq").value, followers: $("#nf").value ? +$("#nf").value : null } }), "Compte ajouté");
    if (r) render(el);
  };
  $("#tadd").onclick = async () => {
    const r = await act(() => api("/targets", { method: "POST", body: { account_id: $("#ta").value || null, metric: $("#tm").value, target: parseFloat($("#tv").value), deadline: $("#td").value } }), "Objectif ajouté");
    if (r) render(el);
  };
}
