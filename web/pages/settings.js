import { api, act, esc, fmt } from "../app.js";

export async function render(el) {
  const [{ settings: s, locked, schedules }, logs] = await Promise.all([api("/settings"), api("/logs?limit=80")]);
  const r = s.model_routing, ph = s.posting_hours;
  el.innerHTML = `<h1>Settings</h1><p class="sub">Réglages non secrets (stockés en base). Les clés API restent dans <code>.env</code>.</p>
  <div class="grid g2">
    <div class="card"><h2>Intelligence & coûts</h2>
      <label>Mode LLM des agents</label><select id="llm_mode">${[["offline", "offline — modèles hors ligne, coût nul"], ["claude_code", "claude_code — via vos sessions Claude Code (quota Pro)"], ["api", "api — API Anthropic (payant, plafonné)"]]
        .map(([v, l]) => `<option value="${v}" ${s.llm_mode === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <label class="check" style="margin-top:12px"><input type="checkbox" id="allow_paid_calls" ${s.allow_paid_calls ? "checked" : ""}> Autoriser les appels payants (API Anthropic)</label>
      <label class="check"><input type="checkbox" id="fallback_to_offline" ${s.fallback_to_offline ? "checked" : ""}> Repli hors ligne si budget atteint / clé absente</label>
      <div class="grid g2"><div><label>Budget journalier ($)</label><input type="number" step="0.1" id="daily_budget_usd" value="${s.daily_budget_usd}"></div>
        <div><label>Budget mensuel ($)</label><input type="number" step="1" id="monthly_budget_usd" value="${s.monthly_budget_usd}"></div></div>
      <label>Routage des modèles (palier → modèle)</label><div class="grid g3">${["simple", "standard", "complex"].map((k) => `<div><span class="m">${k}</span><input id="r_${k}" value="${esc(r[k])}"></div>`).join("")}</div></div>
    <div class="card"><h2>Production</h2><div class="grid g2"><div><label>Contenus par run</label><input type="number" min="1" max="10" id="contents_per_run" value="${s.contents_per_run}"></div>
      <div><label>Langue</label><input id="language" value="${esc(s.language)}"></div></div>
      <label>Plateformes</label><div class="row">${["tiktok", "instagram"].map((p) => `<label class="check"><input type="checkbox" data-pf="${p}" ${s.platforms.includes(p) ? "checked" : ""}> ${p}</label>`).join("")}</div>
      <div class="grid g2"><div><label>Créneaux TikTok (HH:MM, virgules)</label><input id="ph_tiktok" value="${esc((ph.tiktok || []).join(", "))}"></div><div><label>Créneaux Instagram</label><input id="ph_instagram" value="${esc((ph.instagram || []).join(", "))}"></div></div>
      <label>Fournisseur de visuels</label><select id="image_provider">${[["manual", "manual — prompts → Alexya → Drop (recommandé)"], ["placeholder", "placeholder — visuels de test (jamais publiables)"], ["alexya", "alexya — API non vérifiée (désactivé)"]]
        .map(([v, l]) => `<option value="${v}" ${s.image_provider === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <label class="check" style="margin-top:12px"><input type="checkbox" id="voice_enabled" ${s.voice_enabled ? "checked" : ""}> Générer la voix off (ElevenLabs, consomme vos crédits)</label>
      <div class="grid g2"><div><label>Plafond voix / jour (caractères)</label><input type="number" id="voice_daily_char_cap" value="${s.voice_daily_char_cap}"></div>
        <div><label>Taille max upload (Mo)</label><input type="number" id="max_upload_mb" value="${s.max_upload_mb}"></div></div></div>
  </div>
  <div class="row" style="margin-top:12px"><button class="btn primary" id="save">Enregistrer</button></div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h2>Garde-fous verrouillés 🔒</h2><div class="list">${Object.entries({ adult_content: "Contenu adulte / explicite", human_approval_before_publish: "Validation humaine avant publication", ai_disclosure: "Mention « personnage IA »" })
      .map(([k, l]) => `<div class="item"><span>${l}</span><b class="lock">${locked[k] ? "toujours activé" : "toujours désactivé"}</b></div>`).join("")}</div>
      <p class="m">Ces réglages ne sont modifiables ni ici, ni par variable d'environnement.</p></div>
    <div class="card"><h2>Planifications</h2><table><tr><th>Nom</th><th>Règle</th><th>Prochaine</th><th>Actif</th></tr>${schedules.map((x) => `<tr><td>${esc(x.name)}</td>
      <td><input data-spec="${x.id}" value="${esc(x.spec)}" style="width:130px"></td><td class="m">${fmt.dt(x.next_run_at)}</td><td><input type="checkbox" data-en="${x.id}" ${x.enabled ? "checked" : ""}></td></tr>`).join("")}</table>
      <p class="m">Règles : <code>daily:HH:MM</code> (fuseau local) ou <code>every:SECONDES</code>. L'autopilote lance l'agence chaque jour s'il est activé.</p></div>
  </div>
  <div class="card" style="margin-top:16px"><h2>Journal d'activité</h2><div class="scroll" style="max-height:360px"><table>${logs.map((l) => `<tr><td class="mono">${fmt.dt(l.at)}</td><td>${esc(l.level)}</td><td>${esc(l.actor)}</td><td>${esc(l.action)}</td><td class="m">${esc(l.entity || "")} ${esc((l.details || "").slice(0, 140))}</td></tr>`).join("")}</table></div></div>
  <div class="card" style="margin-top:16px"><h2>Accès</h2><p class="m">Si <code>AGENCY_ADMIN_TOKEN</code> est défini (obligatoire en ligne), le dashboard le demande une fois et le garde dans ce navigateur.</p><button class="btn sm" id="logout">Oublier le jeton</button></div>`;
  const $ = (id) => el.querySelector(`#${id}`);
  const hours = (v) => v.split(",").map((x) => x.trim()).filter((x) => /^\d{2}:\d{2}$/.test(x));
  $("save").onclick = async () => {
    if ($("allow_paid_calls").checked && !s.allow_paid_calls && !confirm(`Autoriser des appels payants à l'API Anthropic, plafonnés à ${$("daily_budget_usd").value} $/jour et ${$("monthly_budget_usd").value} $/mois ?`)) return;
    const body = {
      llm_mode: $("llm_mode").value, allow_paid_calls: $("allow_paid_calls").checked, fallback_to_offline: $("fallback_to_offline").checked,
      daily_budget_usd: +$("daily_budget_usd").value, monthly_budget_usd: +$("monthly_budget_usd").value,
      model_routing: { simple: $("r_simple").value, standard: $("r_standard").value, complex: $("r_complex").value },
      contents_per_run: +$("contents_per_run").value, language: $("language").value,
      platforms: [...el.querySelectorAll("[data-pf]:checked")].map((c) => c.dataset.pf),
      posting_hours: { tiktok: hours($("ph_tiktok").value), instagram: hours($("ph_instagram").value) },
      image_provider: $("image_provider").value, voice_enabled: $("voice_enabled").checked,
      voice_daily_char_cap: +$("voice_daily_char_cap").value, max_upload_mb: +$("max_upload_mb").value,
    };
    if (!body.platforms.length) return alert("Choisissez au moins une plateforme.");
    if (await act(() => api("/settings", { method: "PUT", body }), "Réglages enregistrés")) render(el);
  };
  el.querySelectorAll("[data-en]").forEach((c) => (c.onchange = () => act(() => api(`/schedules/${c.dataset.en}`, { method: "PATCH", body: { enabled: c.checked } }), "Planification mise à jour")));
  el.querySelectorAll("[data-spec]").forEach((i) => (i.onchange = () => act(() => api(`/schedules/${i.dataset.spec}`, { method: "PATCH", body: { spec: i.value } }), "Règle mise à jour")));
  $("logout").onclick = () => { try { localStorage.removeItem("agency_token"); } catch { /* ignore */ } alert("Jeton oublié."); };
}
