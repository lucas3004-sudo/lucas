import { api, badge, esc, fmt, go } from "../app.js";

let offset = 0;

export async function render(el) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 1);
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7)); // Monday grid start
  const events = await api(`/calendar?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(new Date(last.getTime() + 7 * 864e5).toISOString())}`);
  const byDay = {};
  for (const e of events) {
    const d = new Date(e.scheduled_at || e.published_at).toDateString();
    (byDay[d] = byDay[d] || []).push(e);
  }
  const days = [];
  for (let d = new Date(start); d < last || days.length % 7; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  el.innerHTML = `<div class="row between"><div><h1>Calendar</h1><p class="sub">Publications planifiées et publiées. Les créneaux suivent Settings › posting_hours.</p></div>
    <div class="row"><button class="btn" id="prev">←</button><b>${first.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</b><button class="btn" id="next">→</button></div></div>
    <div class="scroll"><div class="cal" style="min-width:700px">${["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => `<div class="m" style="text-align:center">${d}</div>`).join("")}
    ${days.map((d) => `<div class="day ${d.toDateString() === now.toDateString() ? "today" : ""}" style="${d.getMonth() !== first.getMonth() ? "opacity:.45" : ""}">
      <div class="m">${d.getDate()}</div>${(byDay[d.toDateString()] || []).map((e) => `<a class="ev" href="#/studio?c=${e.id}" title="${esc(e.title)}">
      ${new Date(e.scheduled_at || e.published_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} ${e.platform === "tiktok" ? "♪" : "◎"} ${esc(e.title)}</a>`).join("")}</div>`).join("")}</div></div>
    <div class="card" style="margin-top:16px"><h2>Ce mois-ci</h2>${events.length ? `<table><tr><th>Date</th><th>Contenu</th><th>Plateforme</th><th>Statut</th></tr>
      ${events.map((e) => `<tr><td>${fmt.dt(e.scheduled_at || e.published_at)}</td><td><a href="#/studio?c=${e.id}">${esc(e.title)}</a></td><td>${esc(e.platform)}</td><td>${badge(e.status)}</td></tr>`).join("")}</table>`
      : `<p class="empty">Aucune publication sur la période</p>`}</div>`;
  el.querySelector("#prev").onclick = () => { offset -= 1; render(el); };
  el.querySelector("#next").onclick = () => { offset += 1; render(el); };
  el.querySelectorAll(".ev").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); go(a.getAttribute("href")); }));
}
