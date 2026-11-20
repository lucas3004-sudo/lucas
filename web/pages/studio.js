import { api, act, assetUrl, badge, esc, fmt, go } from "../app.js";

const COLS = [
  ["Production", ["in_progress", "waiting_assets"]], ["À revoir", ["needs_revision"]], ["À valider", ["awaiting_approval"]],
  ["Planifié / à publier", ["approved", "scheduled", "ready_to_publish"]], ["Publié", ["published"]],
];

export function mediaGrid(assets) {
  const vis = assets.filter((a) => /^(image|video)\//.test(a.mime || "") || /\.(mp4|mov)$/i.test(a.path));
  if (!vis.length) return `<p class="empty">Aucun média</p>`;
  return `<div class="media">${vis.map((a) => `<figure style="margin:0">${/video/.test(a.mime || "") || /\.(mp4|mov)$/i.test(a.path)
    ? `<video src="${assetUrl(a.url)}" controls preload="metadata"></video>` : `<img src="${assetUrl(a.url)}" alt="${esc(a.kind)}" loading="lazy">`}
    <figcaption class="m">${esc(a.kind)} · ${esc(a.source)}</figcaption></figure>`).join("")}</div>`;
}

function detail(c) {
  const qc = c.qc || {};
  const beats = (c.script && c.script.beats) || [];
  const audio = c.assets.filter((a) => a.kind === "audio");
  const exp = c.assets.find((a) => a.kind === "export");
  return `<div class="card" style="margin-top:16px" id="detail">
    <div class="row between"><div><h2 style="margin:0">${esc(c.title)}</h2><div class="m"><code>${c.id}</code> · ${esc(c.platform)} · ${esc(c.format)} · ${esc(c.pillar || "")} · étape <b>${esc(c.stage)}</b></div></div>
      <div class="row">${badge(c.status)}<button class="btn sm" id="close">Fermer</button></div></div>
    <div class="grid g2" style="margin-top:12px">
      <div>
        <h3>Concept</h3><p>${esc(c.concept || "—")}</p>
        <h3>Hook</h3><p><b>${esc(c.hook || "—")}</b></p>
        ${beats.length ? `<h3>Script (${c.script.duration_s || "?"} s)</h3><div class="scroll"><table><tr><th>t</th><th>Visuel</th><th>Texte écran</th><th>Voix</th></tr>
          ${beats.map((b) => `<tr><td class="mono">${esc(b.t)}</td><td>${esc(b.visual)}</td><td>${esc(b.on_screen_text)}</td><td>${esc(b.voiceover)}</td></tr>`).join("")}</table></div>` : ""}
        <label>Légende (modifiable)</label><textarea id="caption">${esc(c.caption || "")}</textarea>
        <label>Hashtags</label><input id="tags" value="${esc((c.hashtags || []).join(" "))}">
        <div class="row" style="margin-top:8px"><button class="btn" id="save">Enregistrer</button><button class="btn" id="requalify">Relancer le QC</button></div>
      </div>
      <div>
        <h3>Médias</h3>${mediaGrid(c.assets)}
        ${audio.map((a) => `<audio controls src="${assetUrl(a.url)}" style="width:100%;margin-top:8px"></audio>`).join("")}
        <div class="row" style="margin-top:8px"><a class="btn sm" href="#/generator?c=${c.id}">Prompts & Drop →</a>${exp ? `<a class="btn sm primary" href="${assetUrl(exp.url)}">Télécharger le paquet d'export</a>` : ""}</div>
        <h3 style="margin-top:16px">Contrôle qualité ${qc.score != null ? `<span class="badge ${qc.passed ? "good" : "crit"}">${qc.passed ? "✓" : "✕"} ${qc.score}/100</span>` : ""}</h3>
        ${(qc.blockers || []).map((b) => `<div class="badge crit">✕ ${esc(b)}</div>`).join(" ")} ${(qc.warnings || []).map((w) => `<div class="badge warn">! ${esc(w)}</div>`).join(" ")}
        ${(qc.fixes || []).map((f) => `<div class="badge good">✓ ${esc(f)}</div>`).join(" ")}
        <h3 style="margin-top:16px">Décision</h3>
        ${c.status === "awaiting_approval" ? `<label>Créneau (optionnel, sinon automatique)</label><input type="datetime-local" id="when">
          <div class="row" style="margin-top:8px"><button class="btn primary" id="approve">✓ Approuver & planifier</button><button class="btn danger" id="reject">Rejeter</button></div>` : ""}
        ${["ready_to_publish", "scheduled"].includes(c.status) ? `<label>URL de la publication</label><input id="url" placeholder="https://…"><button class="btn primary" id="published" style="margin-top:8px">Marquer comme publié</button>` : ""}
        <label>Retour pour régénérer (script, ton, angle…)</label><input id="feedback" placeholder="ex. hook plus court, ton plus drôle">
        <button class="btn" id="regen" style="margin-top:8px">↻ Régénérer</button>
        ${c.status === "published" ? `<h3 style="margin-top:16px">Statistiques (saisie manuelle)</h3><div class="grid g3">
          ${["views", "likes", "comments", "shares", "saves", "followers_delta"].map((k) => `<div><label>${k}</label><input type="number" min="0" data-m="${k}"></div>`).join("")}</div>
          <button class="btn" id="metrics" style="margin-top:8px">Enregistrer les stats</button>` : ""}
      </div>
    </div>
    <h3 style="margin-top:16px">Historique</h3>
    <div class="scroll"><table>${c.history.map((h) => `<tr><td class="mono">${fmt.dt(h.at)}</td><td>${esc(h.actor)}</td><td>${esc(h.action)}</td><td class="m">${esc((h.details || "").slice(0, 160))}</td></tr>`).join("")}</table></div>
  </div>`;
}

export async function render(el, params) {
  const list = await api("/contents");
  el.innerHTML = `<div class="row between"><div><h1>Content Studio</h1><p class="sub">Chaque contenu : ID, statut, plateforme, format, concept, script, fichiers, QC et historique.</p></div>
    <button class="btn" id="new">+ Nouveau contenu</button></div>
    <div id="newform" class="card" hidden><div class="grid g4"><div><label>Titre / sujet</label><input id="nt"></div>
      <div><label>Plateforme</label><select id="np"><option>instagram</option><option>tiktok</option></select></div>
      <div><label>Format</label><select id="nf"><option>reel</option><option>carousel</option><option>photo</option><option>tutorial</option><option>talking_head</option><option>storytime</option></select></div>
      <div><label>Hook (optionnel)</label><input id="nh"></div></div><button class="btn primary" id="create" style="margin-top:8px">Créer et lancer la rédaction</button></div>
    <div class="kanban" style="margin-top:12px">${COLS.map(([t, sts]) => {
      const items = list.filter((c) => sts.includes(c.status));
      return `<div class="col"><h3>${t}<span class="badge">${items.length}</span></h3>${items.map((c) => `<div class="card flat" data-open="${c.id}">
        <div class="t">${esc(c.title)}</div><div class="m">${esc(c.platform)} · ${esc(c.format)}</div><div style="margin-top:4px">${badge(c.status)}</div></div>`).join("") || `<p class="empty">—</p>`}</div>`;
    }).join("")}</div>
    ${list.some((c) => c.status === "rejected") ? `<p class="sub">${list.filter((c) => c.status === "rejected").length} contenu(s) rejeté(s) masqué(s).</p>` : ""}
    <div id="slot"></div>`;
  el.querySelector("#new").onclick = () => { el.querySelector("#newform").hidden = false; };
  el.querySelector("#create").onclick = async () => {
    const r = await act(() => api("/contents", { method: "POST", body: { title: el.querySelector("#nt").value, platform: el.querySelector("#np").value, format: el.querySelector("#nf").value, hook: el.querySelector("#nh").value } }), "Contenu créé (rédaction en file)");
    if (r) go(`#/studio?c=${r.id}`);
  };
  el.querySelectorAll("[data-open]").forEach((n) => (n.onclick = () => go(`#/studio?c=${n.dataset.open}`)));
  if (params.c) await open(el, params.c);
}

async function open(el, id) {
  const c = await api(`/contents/${id}`);
  const slot = el.querySelector("#slot");
  slot.innerHTML = detail(c);
  slot.scrollIntoView({ behavior: "smooth", block: "start" });
  const $ = (s) => slot.querySelector(s);
  const reload = () => open(el, id);
  $("#close").onclick = () => go("#/studio");
  $("#save").onclick = async () => { await act(() => api(`/contents/${id}`, { method: "PATCH", body: { caption: $("#caption").value, hashtags: $("#tags").value.split(/\s+/).filter(Boolean) } }), "Enregistré"); reload(); };
  $("#requalify").onclick = async () => { await act(() => api(`/contents/${id}/requalify`, { method: "POST" }), "QC relancé"); reload(); };
  $("#regen").onclick = async () => { await act(() => api(`/contents/${id}/regenerate`, { method: "POST", body: { feedback: $("#feedback").value } }), "Régénéré"); reload(); };
  if ($("#approve")) $("#approve").onclick = async () => { const w = $("#when").value; await act(() => api(`/contents/${id}/approve`, { method: "POST", body: w ? { scheduled_at: new Date(w).toISOString() } : {} }), "Approuvé et planifié ✓"); reload(); };
  if ($("#reject")) $("#reject").onclick = async () => { const reason = prompt("Raison du rejet ?"); if (reason !== null) { await act(() => api(`/contents/${id}/reject`, { method: "POST", body: { reason } })); reload(); } };
  if ($("#published")) $("#published").onclick = async () => { await act(() => api(`/contents/${id}/mark-published`, { method: "POST", body: { url: $("#url").value } }), "Marqué publié"); reload(); };
  if ($("#metrics")) $("#metrics").onclick = async () => {
    const body = { content_id: id, platform: c.platform, date: new Date().toISOString().slice(0, 10) };
    slot.querySelectorAll("[data-m]").forEach((i) => { if (i.value !== "") body[i.dataset.m] = parseInt(i.value, 10); });
    await act(() => api("/metrics", { method: "POST", body }), "Statistiques enregistrées (provenance : saisie manuelle)"); reload();
  };
}
