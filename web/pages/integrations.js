import { api, act, badge, esc, fmt } from "../app.js";

export async function render(el) {
  const list = await api("/integrations");
  el.innerHTML = `<h1>Integrations</h1><p class="sub">« Vérifié » n'apparaît qu'après un vrai appel de test réussi. Les clés se configurent dans le fichier <code>.env</code> (jamais dans le dashboard, jamais dans git).</p>
  <div class="grid g2">${list.map((i) => `<div class="card"><div class="row between"><h2 style="margin:0">${esc(i.label)}</h2>${badge(i.status)}</div>
    <p>${esc(i.purpose)} ${i.paid ? `<span class="badge warn">! service payant</span>` : `<span class="badge">gratuit</span>`}</p>
    ${i.note ? `<p class="m">${esc(i.note)}</p>` : ""}
    ${i.secret ? `<p class="m">Clé : <code>${esc(i.secret)}</code> dans <code>.env</code></p>` : ""}
    ${i.last_check ? `<p class="m">Dernier test ${fmt.dt(i.last_check.checked_at)} : <code>${esc(JSON.stringify(i.last_check.details).slice(0, 220))}</code></p>` : ""}
    <div class="row">${["elevenlabs", "anthropic", "ffmpeg", "webhook"].includes(i.name) ? `<button class="btn sm" data-test="${i.name}">Tester</button>` : ""}
      ${i.docs ? `<a class="btn sm" href="${esc(i.docs)}" target="_blank" rel="noopener">Documentation</a>` : ""}</div></div>`).join("")}</div>
  <div class="card" style="margin-top:16px"><h2>Générateur visuel : comment ça marche aujourd'hui</h2>
    <p>L'API d'Alexya n'a pas pu être vérifiée (site inaccessible depuis l'environnement de développement). En attendant : <b>mode manuel</b> — le Prompt Engineer écrit les prompts,
    vous les collez dans Alexya, puis vous déposez les visuels dans <a href="#/generator">Generator</a>. Dès qu'une API officielle est confirmée (docs + clé), l'intégration sera branchée et testée.</p>
    <p class="m">Le test ElevenLabs appelle <code>GET /v1/user/subscription</code> et <code>GET /v2/voices</code> (gratuits). La génération vocale reste désactivée tant que <code>voice_enabled</code> n'est pas activé dans Settings.</p></div>`;
  el.querySelectorAll("[data-test]").forEach((b) => (b.onclick = async () => {
    b.disabled = true; b.textContent = "Test…";
    await act(() => api(`/integrations/${b.dataset.test}/test`, { method: "POST" }));
    render(el);
  }));
}
