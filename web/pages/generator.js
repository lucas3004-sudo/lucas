// Generator = the "sas": prompts to copy into Alexya (or another authorised tool), then Drop the non-explicit results here.
import { api, act, badge, esc, go, toast } from "../app.js";
import { mediaGrid } from "./studio.js";

function dropZone(contentId) {
  return `<div class="drop" id="drop"><p><b>Déposez vos visuels ici</b> (jpg, png, webp, mp4, mov, mp3, wav, m4a)</p>
    <label class="check" style="justify-content:center"><input type="checkbox" id="attest"> Je certifie que ces fichiers sont <b>non explicites</b> et ne représentent pas une personne réelle sans autorisation.</label>
    <input type="file" id="file" multiple accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.mp3,.wav,.m4a" style="margin-top:8px">
    <p class="m">${contentId ? "Rattachés au contenu sélectionné." : "Bibliothèque Drop générale (non rattachée)."}</p></div>`;
}

async function upload(files, contentId) {
  for (const f of files) {
    const fd = new FormData();
    fd.append("file", f); fd.append("non_explicit", "true"); fd.append("kind", "drop");
    if (contentId) fd.append("content_id", contentId);
    await act(() => api("/uploads", { method: "POST", body: fd }), `Importé : ${f.name}`);
  }
}

function wireDrop(el, contentId, after) {
  const z = el.querySelector("#drop"), attest = el.querySelector("#attest");
  const go2 = async (files) => {
    if (!attest.checked) return toast("Cochez la certification « non explicite » avant d'importer.");
    await upload(files, contentId); after();
  };
  el.querySelector("#file").onchange = (e) => go2([...e.target.files]);
  z.ondragover = (e) => { e.preventDefault(); z.classList.add("over"); };
  z.ondragleave = () => z.classList.remove("over");
  z.ondrop = (e) => { e.preventDefault(); z.classList.remove("over"); go2([...e.dataTransfer.files]); };
}

export async function render(el, params) {
  const all = await api("/contents");
  const queue = all.filter((c) => ["waiting_assets", "in_progress", "needs_revision"].includes(c.status));
  const id = params.c || (queue.find((c) => c.status === "waiting_assets") || {}).id;
  el.innerHTML = `<h1>Generator</h1><p class="sub">Le sas : copiez les prompts dans Alexya (ou un outil autorisé), générez, puis déposez les résultats non explicites ici. L'OS reprend ensuite le montage, le QC et la planification.</p>
    <div class="grid split">
      <div class="card"><h2>Contenus</h2><div class="list">${queue.map((c) => `<div class="item" style="cursor:pointer" data-c="${c.id}"><div><div class="t" ${c.id === id ? 'style="color:var(--accent)"' : ""}>${esc(c.title)}</div><div class="m">${esc(c.platform)} · ${esc(c.format)}</div></div>${badge(c.status)}</div>`).join("") || `<p class="empty">Aucun contenu en production</p>`}</div></div>
      <div id="gen"></div>
    </div>
    <div class="card" style="margin-top:16px"><h2>Bibliothèque Drop</h2>${dropZone(null)}<div id="lib" style="margin-top:12px"></div></div>`;
  el.querySelectorAll("[data-c]").forEach((n) => (n.onclick = () => go(`#/generator?c=${n.dataset.c}`)));
  const libEl = el.querySelector("#lib");
  const lib = async () => { libEl.innerHTML = mediaGrid(await api("/assets?kind=drop")); };
  if (!id) {
    el.querySelector("#gen").innerHTML = `<div class="card"><p class="empty">Sélectionnez un contenu.</p></div>`;
  } else {
    await panel(el.querySelector("#gen"), id);
  }
  const libCard = el.querySelector(".card:last-child");
  wireDrop(libCard, null, lib);
  lib();
}

async function panel(box, id) {
  const c = await api(`/contents/${id}`);
  const p = c.prompts || {};
  const ips = p.image_prompts || [];
  box.innerHTML = `<div class="card"><div class="row between"><h2 style="margin:0">${esc(c.title)}</h2>${badge(c.status)}</div>
    ${ips.length ? "" : `<p class="empty">Prompts pas encore écrits (étape « prompt » du pipeline).</p>`}
    ${ips.map((x, i) => `<div style="margin-top:12px"><div class="row between"><b>${esc(x.shot)} · ${esc(x.aspect_ratio)}</b><button class="btn sm" data-copy="p${i}">Copier le prompt</button></div>
      <div class="pre" id="p${i}">${esc(x.prompt)}</div><div class="row between" style="margin-top:4px"><span class="m">Negative prompt</span><button class="btn sm" data-copy="n${i}">Copier</button></div>
      <div class="pre m" id="n${i}">${esc(x.negative_prompt)}</div></div>`).join("")}
    ${p.video_prompt ? `<div style="margin-top:12px"><div class="row between"><b>Prompt vidéo</b><button class="btn sm" data-copy="vp">Copier</button></div><div class="pre" id="vp">${esc(p.video_prompt)}</div></div>` : ""}
    ${p.voiceover_text ? `<div style="margin-top:12px"><div class="row between"><b>Texte voix off</b><button class="btn sm" data-copy="vo">Copier</button></div><div class="pre" id="vo">${esc(p.voiceover_text)}</div><p class="m">Direction : ${esc(p.voice_direction || "")}</p></div>` : ""}
    <h3 style="margin-top:16px">Fichiers du contenu</h3>${mediaGrid(c.assets)}
    <div style="margin-top:12px">${dropZone(id)}</div>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="continue">Continuer la production (montage → QC)</button><a class="btn" href="#/studio?c=${id}">Ouvrir dans le Studio</a></div></div>`;
  box.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = async () => {
    try { await navigator.clipboard.writeText(box.querySelector(`#${b.dataset.copy}`).textContent); toast("Copié"); } catch { toast("Copie impossible : sélectionnez le texte manuellement."); }
  }));
  wireDrop(box, id, () => panel(box, id));
  box.querySelector("#continue").onclick = async () => {
    const r = await act(() => api(`/contents/${id}/continue`, { method: "POST" }));
    if (r) { toast(`Étapes exécutées : ${r.steps.map((s) => `${s.type} (${s.status})`).join(", ") || "aucune"}`, 6000); go(`#/studio?c=${id}`); }
  };
}
