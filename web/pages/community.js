import { api, act, badge, esc, fmt } from "../app.js";

let filter = "";

export async function render(el) {
  const msgs = await api(`/messages${filter ? `?status=${filter}` : ""}`);
  const all = filter ? await api("/messages") : msgs;
  const count = (s) => all.filter((m) => m.status === s).length;
  const sent = { positive: "good", negative: "crit", neutral: "" };
  el.innerHTML = `<h1>Community</h1><p class="sub">Classement, sentiment, réponses proposées (brouillons à valider) et escalade humaine. Aucune réponse n'est envoyée automatiquement ; le personnage ne prétend jamais être humain.</p>
  <div class="grid g2"><div class="card"><h2>Importer des commentaires / messages</h2>
    <p class="m">Copiez-collez depuis vos plateformes (aucun scraping). Une ligne par message, ou CSV avec en-tête <code>platform,author,text</code>.</p>
    <div class="grid g2"><div><label>Plateforme</label><select id="pf"><option>instagram</option><option>tiktok</option></select></div><div><label>Format</label><select id="fmt"><option value="lines">1 message par ligne</option><option value="csv">CSV</option></select></div></div>
    <textarea id="raw" placeholder="Trop beau ce look !&#10;Tu es une IA ?"></textarea><button class="btn primary" id="imp" style="margin-top:8px">Importer & trier</button></div>
    <div class="card"><h2>Synthèse</h2><div class="list">
      ${[["new", "Nouveaux"], ["drafted", "Réponses prêtes"], ["needs_human", "Humain requis"], ["replied", "Répondus"], ["ignored", "Ignorés (spam)"]].map(([s, l]) => `<div class="item"><span>${l}</span><span class="row">${badge(s)} <b>${count(s)}</b></span></div>`).join("")}</div>
      <button class="btn" id="tri" style="margin-top:8px">Trier les nouveaux</button></div></div>
  <div class="row" style="margin:16px 0 8px">${[["", "Tous"], ["needs_human", "Humain requis"], ["drafted", "Réponses prêtes"], ["new", "Nouveaux"], ["replied", "Répondus"]].map(([s, l]) => `<button class="btn sm ${s === filter ? "primary" : ""}" data-f="${s}">${l}</button>`).join("")}</div>
  <div class="card"><div class="list">${msgs.map((m) => `<div class="item" style="display:block">
    <div class="row between"><div><b>${esc(m.author || "anonyme")}</b> <span class="m">${esc(m.platform)} · ${fmt.dt(m.received_at)}</span></div>
      <div class="row">${m.category ? `<span class="badge">${esc(m.category)}</span>` : ""}${m.sentiment ? `<span class="badge ${sent[m.sentiment]}">${esc(m.sentiment)}</span>` : ""}${m.priority ? `<span class="badge">${esc(m.priority)}</span>` : ""}${badge(m.status)}</div></div>
    <p style="margin:6px 0">${esc(m.text)}</p>
    ${m.escalation_reason ? `<div class="badge crit">✕ Escalade : ${esc(m.escalation_reason)}</div>` : ""}
    ${m.status !== "ignored" ? `<div class="row" style="margin-top:6px"><input data-reply="${m.id}" value="${esc(m.final_reply || m.suggested_reply || "")}" placeholder="Votre réponse" style="flex:1;min-width:200px">
      <button class="btn sm primary" data-done="${m.id}">Marquer répondu</button><button class="btn sm" data-ign="${m.id}">Ignorer</button>
      <button class="btn sm" data-copy="${m.id}">Copier</button></div>` : ""}</div>`).join("") || `<p class="empty">Aucun message</p>`}</div></div>`;
  const $ = (s) => el.querySelector(s);
  $("#imp").onclick = async () => {
    const raw = $("#raw").value.trim();
    if (!raw) return;
    const body = $("#fmt").value === "csv" ? { csv: raw } : { messages: raw.split("\n").filter(Boolean).map((text) => ({ platform: $("#pf").value, text })) };
    const r = await act(() => api("/messages/import", { method: "POST", body }));
    if (r) { alert(`${r.imported} message(s) importé(s)${r.triage ? ` · tri : ${JSON.stringify(r.triage.result || r.triage.status)}` : ""}`); render(el); }
  };
  $("#tri").onclick = async () => { await act(() => api("/messages/triage", { method: "POST" }), "Tri effectué"); render(el); };
  el.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { filter = b.dataset.f; render(el); }));
  const reply = (id) => el.querySelector(`[data-reply="${id}"]`).value;
  el.querySelectorAll("[data-done]").forEach((b) => (b.onclick = async () => { await act(() => api(`/messages/${b.dataset.done}`, { method: "PATCH", body: { status: "replied", final_reply: reply(b.dataset.done) } }), "Marqué répondu"); render(el); }));
  el.querySelectorAll("[data-ign]").forEach((b) => (b.onclick = async () => { await act(() => api(`/messages/${b.dataset.ign}`, { method: "PATCH", body: { status: "ignored" } })); render(el); }));
  el.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => navigator.clipboard.writeText(reply(b.dataset.copy)).catch(() => {})));
}
