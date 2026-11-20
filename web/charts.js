// Minimal SVG charts (single series): one hue, recessive axes, 4px rounded data-ends, 2px gaps, hover tooltips.
import { esc } from "./app.js";

const W = 600;
const nice = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p; };
const short = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`);

// data: [{label, value, tip}] ; returns HTML (call wire(el) after insertion)
export function bars(data, { height = 180, title = "" } = {}) {
  if (!data.length) return `<p class="empty">Pas encore de données</p>`;
  const H = height, padL = 36, padB = 22, padT = 8;
  const max = nice(Math.max(...data.map((d) => d.value || 0)));
  const iw = W - padL, ih = H - padB - padT;
  const bw = Math.max(2, iw / data.length - 2);
  const y = (v) => padT + ih - (v / max) * ih;
  const grid = [0, 0.5, 1].map((f) => `<line class="grid-line" x1="${padL}" x2="${W}" y1="${y(max * f)}" y2="${y(max * f)}"/>
    <text class="axis" x="${padL - 6}" y="${y(max * f) + 4}" text-anchor="end">${short(max * f)}</text>`).join("");
  const every = Math.ceil(data.length / 8);
  const marks = data.map((d, i) => {
    const x = padL + i * (bw + 2) + 1, top = y(d.value || 0), h = padT + ih - top, r = Math.min(4, bw / 2, h);
    const path = h > 0 ? `M${x},${padT + ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${padT + ih} Z` : "";
    const lbl = i % every === 0 ? `<text class="axis" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>` : "";
    return `<rect class="hit" data-tip="${esc(d.tip || `${d.label} : ${d.value}`)}" x="${x}" y="${padT}" width="${bw}" height="${ih}"/>
      <path class="bar" d="${path}"/>${lbl}`;
  }).join("");
  return `<div class="chart" role="img" aria-label="${esc(title)}"><svg viewBox="0 0 ${W} ${H}">${grid}${marks}</svg><div class="tip"></div></div>`;
}

export function wire(root) {
  root.querySelectorAll(".chart").forEach((c) => {
    const tip = c.querySelector(".tip");
    c.addEventListener("mousemove", (e) => {
      const t = e.target.closest("[data-tip]");
      if (!t) { tip.style.display = "none"; return; }
      const r = c.getBoundingClientRect();
      tip.textContent = t.dataset.tip; tip.style.display = "block";
      tip.style.left = `${e.clientX - r.left}px`; tip.style.top = `${e.clientY - r.top}px`;
    });
    c.addEventListener("mouseleave", () => { tip.style.display = "none"; });
  });
}

// items: [{label, value, display}] -> horizontal bars, value text in ink (never series color)
export function hbars(items) {
  if (!items.length) return `<p class="empty">Pas encore de données</p>`;
  const max = Math.max(...items.map((i) => i.value || 0)) || 1;
  return items.map((i) => `<div class="hbar"><span>${esc(i.label)}</span><div class="track"><div class="fill" style="width:${((i.value || 0) / max) * 100}%"></div></div>
    <span class="mono">${esc(i.display ?? i.value)}</span></div>`).join("");
}

export function stat(label, value, hint = "", provenance = "") {
  return `<div class="card stat"><div class="row between"><span class="label">${esc(label)}</span>${provenance}</div>
    <div class="value">${value}</div><div class="hint">${hint}</div></div>`;
}
