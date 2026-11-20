import { api, act, assetUrl, esc, toast } from "../app.js";

const list = (a) => (a || []).join(", ");
const split = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

export async function render(el) {
  const c = await api("/character");
  const v = c.visual_identity, vo = c.voice, ed = c.editorial_line, d = c.disclosure;
  const f = (id, label, val, area = false) => `<div><label>${label}</label>${area ? `<textarea id="${id}">${esc(val)}</textarea>` : `<input id="${id}" value="${esc(val)}">`}</div>`;
  el.innerHTML = `<h1>Character Studio</h1><p class="sub">La bible du personnage : source unique utilisée par tous les agents (prompts, scripts, voix, QC).</p>
  ${c.is_placeholder ? `<div class="card" style="border-color:var(--warning)"><b>! Profil provisoire.</b> Personnalisez le nom, la niche et l'identité visuelle puis enregistrez.</div>` : ""}
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h2>Identité</h2><div class="grid g2">${f("name", "Nom", c.name)}${f("age", "Âge (adulte, ≥ 18)", c.age)}</div>
      ${f("tagline", "Accroche", c.tagline)}${f("bio", "Biographie", c.bio, true)}${f("personality", "Personnalité (virgules)", list(c.personality))}
      ${f("values", "Valeurs (virgules)", list(c.values))}${f("tone", "Ton", c.tone)}${f("niche", "Niche", c.niche)}
      <label>Piliers éditoriaux (une ligne par pilier : Nom: sujet1, sujet2)</label><textarea id="pillars" style="min-height:110px">${esc(c.pillars.map((p) => `${p.name}: ${p.topics.join(", ")}`).join("\n"))}</textarea></div>
    <div class="card"><h2>Identité visuelle</h2>${f("face", "Visage (signes reconnaissables)", v.face, true)}<div class="grid g2">${f("hair", "Cheveux", v.hair)}${f("eyes", "Yeux", v.eyes)}</div>
      ${f("signature", "Signature visuelle", v.signature)}${f("style", "Style vestimentaire", v.style)}${f("wardrobe", "Garde-robe (virgules)", list(c.wardrobe))}
      ${f("photography", "Photographie / décor", v.photography)}${f("vdo", "À faire (virgules)", list(v.do))}${f("vdont", "Interdits (virgules)", list(v.dont))}</div>
    <div class="card"><h2>Voix (ElevenLabs)</h2><div class="grid g2">${f("voice_id", "voice_id", vo.voice_id || "")}${f("model_id", "Modèle", vo.model_id)}</div>
      ${f("vdesc", "Description de la voix", vo.description)}
      <div class="grid g3">${["stability", "similarity_boost", "style", "speed"].map((k) => `<div><label>${k} <span class="mono" id="vs-${k}-v">${vo.settings[k]}</span></label>
        <input type="range" id="vs-${k}" min="${k === "speed" ? 0.7 : 0}" max="${k === "speed" ? 1.2 : 1}" step="0.05" value="${vo.settings[k]}"></div>`).join("")}
        <label class="check" style="margin-top:28px"><input type="checkbox" id="use_speaker_boost" ${vo.settings.use_speaker_boost ? "checked" : ""}> speaker boost</label></div>
      <div class="row" style="margin-top:8px"><button class="btn" id="voices">Lister mes voix</button><button class="btn" id="preview">▶ Aperçu (consomme des crédits)</button></div>
      <div id="vlist" class="m"></div><div id="vprev"></div></div>
    <div class="card"><h2>Ligne éditoriale & transparence</h2>${f("mission", "Mission", ed.mission, true)}${f("audience", "Audience (adultes)", ed.audience)}
      ${f("edo", "À faire (virgules)", list(ed.do))}${f("edont", "Interdits (virgules)", list(ed.dont))}
      ${f("dshort", "Mention IA courte (légendes)", d.short)}${f("dbio", "Ligne de bio", d.bio_line)}${f("dlong", "Mention longue", d.long, true)}</div>
  </div>
  <div class="row" style="margin-top:12px"><button class="btn primary" id="save">Enregistrer la fiche</button></div>
  <div class="card" style="margin-top:16px"><h2>Références visuelles autorisées</h2><p class="m">${esc(c.references_policy)}</p>
    <label class="check"><input type="checkbox" id="attest"> Je certifie : non explicite, généré pour ce personnage ou libre de droits, aucun visage de personne réelle.</label>
    <input type="file" id="ref" multiple accept=".jpg,.jpeg,.png,.webp" style="margin-top:8px">
    <div class="media" style="margin-top:12px">${c.references.map((r) => `<figure style="margin:0"><img src="${assetUrl(r.url)}" alt="référence">
      <figcaption class="row between"><label class="check"><input type="checkbox" data-appr="${r.id}" ${r.approved ? "checked" : ""}> approuvée</label><button class="btn sm danger" data-del="${r.id}">✕</button></figcaption></figure>`).join("")}</div></div>`;

  const $ = (s) => el.querySelector(`#${s}`);
  ["stability", "similarity_boost", "style", "speed"].forEach((k) => ($(`vs-${k}`).oninput = () => { $(`vs-${k}-v`).textContent = $(`vs-${k}`).value; }));
  $("save").onclick = async () => {
    const body = {
      name: $("name").value, age: parseInt($("age").value, 10), tagline: $("tagline").value, bio: $("bio").value, personality: split($("personality").value),
      values: split($("values").value), tone: $("tone").value, niche: $("niche").value, wardrobe: split($("wardrobe").value),
      pillars: $("pillars").value.split("\n").filter((l) => l.includes(":")).map((l) => ({ name: l.split(":")[0].trim(), topics: split(l.split(":").slice(1).join(":")) })),
      visual_identity: { ...v, face: $("face").value, hair: $("hair").value, eyes: $("eyes").value, signature: $("signature").value, style: $("style").value,
        photography: $("photography").value, do: split($("vdo").value), dont: split($("vdont").value) },
      voice: { ...vo, voice_id: $("voice_id").value || null, model_id: $("model_id").value, description: $("vdesc").value,
        settings: { stability: +$("vs-stability").value, similarity_boost: +$("vs-similarity_boost").value, style: +$("vs-style").value, speed: +$("vs-speed").value, use_speaker_boost: $("use_speaker_boost").checked } },
      editorial_line: { ...ed, mission: $("mission").value, audience: $("audience").value, do: split($("edo").value), dont: split($("edont").value) },
      disclosure: { short: $("dshort").value, bio_line: $("dbio").value, long: $("dlong").value },
    };
    if (body.pillars.length === 0) return toast("Au moins un pilier est requis.");
    if (await act(() => api("/character", { method: "PUT", body }), "Fiche enregistrée")) render(el);
  };
  $("voices").onclick = async () => {
    const vs = await act(() => api("/integrations/elevenlabs/voices"));
    if (vs) $("vlist").innerHTML = vs.map((x) => `<div><code>${esc(x.voice_id)}</code> ${esc(x.name)} (${esc(x.category || "")}) <button class="btn sm" data-vid="${esc(x.voice_id)}">Utiliser</button></div>`).join("") || "Aucune voix";
    el.querySelectorAll("[data-vid]").forEach((b) => (b.onclick = () => { $("voice_id").value = b.dataset.vid; toast("voice_id renseigné : enregistrez la fiche"); }));
  };
  $("preview").onclick = async () => {
    const a = await act(() => api("/character/voice-preview", { method: "POST", body: {} }));
    if (a) $("vprev").innerHTML = `<audio controls autoplay src="${assetUrl(a.url)}" style="width:100%;margin-top:8px"></audio>`;
  };
  $("ref").onchange = async (e) => {
    if (!$("attest").checked) return toast("Cochez la certification avant d'importer.");
    for (const file of e.target.files) {
      const fd = new FormData(); fd.append("file", file); fd.append("kind", "reference"); fd.append("non_explicit", "true");
      await act(() => api("/uploads", { method: "POST", body: fd }));
    }
    render(el);
  };
  el.querySelectorAll("[data-appr]").forEach((cb) => (cb.onchange = () => act(() => api(`/assets/${cb.dataset.appr}`, { method: "PATCH", body: { approved: cb.checked } }), "Mis à jour")));
  el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => { if (confirm("Supprimer cette référence ?")) { await act(() => api(`/assets/${b.dataset.del}`, { method: "DELETE" })); render(el); } }));
}
