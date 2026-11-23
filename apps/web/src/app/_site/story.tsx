"use client";
/**
 * Scène d'ouverture de la page d'accueil (D-058) : le titre, puis la fenêtre du logiciel qui
 * « s'allume » et se transforme au fil du défilement — carte, analyse (les courbes se
 * déforment), acquéreurs, mandats. Le défilement est converti en quelques variables CSS posées
 * sur la section (aucun rendu React pendant le défilement) ; tout le reste est du CSS.
 * Les chiffres de la maquette sont des exemples, signalés à l'écran.
 */
import Link from "next/link";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { LogoMark } from "@/ui/logo";
import { SiteIcon, type SiteIconName } from "./icons";

const v = (vars: Record<string, string | number>) => vars as CSSProperties;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);

const STEPS: { label: string; title: string; text: string; icon: SiteIconName }[] = [
  { label: "La carte", icon: "map", title: "Tous vos biens, sur une carte.", text: "Prix, ventes réelles autour, recherche par lieu et par rayon : les bonnes affaires sautent aux yeux." },
  { label: "L'analyse", icon: "chart", title: "Chaque prix, comparé au marché.", text: "La fourchette tirée des ventes réelles, la courbe du quartier, le rendement et un verdict clair." },
  { label: "Les acquéreurs", icon: "target", title: "Les bons acquéreurs, aussitôt.", text: "Chaque nouveau bien est rapproché des recherches de toute l'agence ; le collègue concerné est prévenu." },
  { label: "Les mandats", icon: "key", title: "Rien n'est oublié.", text: "Échéances des mandats, étapes des affaires, rappels préparés par vos agents : vous validez, ils s'occupent du reste." },
];

/** Couleur d'accent de chaque étape (terre cuite, ambre, rose, or) : elle glisse de l'une à l'autre. */
const ACCENTS = [
  [236, 122, 60],
  [226, 85, 58],
  [214, 74, 104],
  [222, 150, 44],
] as const;

// Courbes « prix au m² du quartier » sur 1, 3 et 5 ans : même nombre de points, le tracé se déforme.
const SERIES = [
  [2480, 2510, 2495, 2540, 2580, 2560, 2610, 2650, 2630, 2680, 2720, 2750],
  [2200, 2280, 2350, 2330, 2420, 2500, 2470, 2560, 2610, 2590, 2680, 2750],
  [1900, 2010, 2080, 2150, 2120, 2260, 2340, 2410, 2390, 2520, 2630, 2750],
];
const ASKING = [1.07, 1.08, 1.06, 1.09, 1.07, 1.05, 1.08, 1.06, 1.07, 1.05, 1.06, 1.05];
const PERIODS = ["1 an", "3 ans", "5 ans"];
const CHART = { w: 520, h: 170, min: 1800, max: 3000 };

function chartPoints(values: number[]): [number, number][] {
  return values.map((val, i) => [(i / (values.length - 1)) * CHART.w, CHART.h - 8 - ((val - CHART.min) / (CHART.max - CHART.min)) * (CHART.h - 24)]);
}

/** Tracé lissé (Catmull-Rom converti en courbes de Bézier). */
function smoothPath(pts: [number, number][]): string {
  let d = `M${pts[0]![0].toFixed(1)} ${pts[0]![1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]!.toFixed(1)} ${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)} ${c2[1]!.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function seriesAt(u: number): number[] {
  const i = Math.min(1, Math.floor(u));
  const f = u - i;
  return SERIES[0]!.map((_, k) => SERIES[i]![k]! + (SERIES[i + 1]![k]! - SERIES[i]![k]!) * f);
}

const initialSeries = seriesAt(0);
const INITIAL_AREA = `${smoothPath(chartPoints(initialSeries))} L${CHART.w} ${CHART.h} L0 ${CHART.h} Z`;
const INITIAL_LINE = smoothPath(chartPoints(initialSeries));
const INITIAL_ASK = smoothPath(chartPoints(initialSeries.map((x, k) => x * ASKING[k]!)));

export function Story({ cta }: { cta: { href: string; label: string } }) {
  const root = useRef<HTMLElement>(null);
  const area = useRef<SVGPathElement>(null);
  const line = useRef<SVGPathElement>(null);
  const ask = useRef<SVGPathElement>(null);
  const growth = useRef<HTMLSpanElement>(null);
  const days = useRef<HTMLSpanElement>(null);
  const matches = useRef<HTMLSpanElement>(null);
  const periods = useRef<HTMLSpanElement[]>([]);
  const hero = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (still.matches) return;

    let frame = 0;
    let last = "";
    const update = () => {
      frame = 0;
      const desktop = window.innerWidth >= 1024;
      // Sur téléphone, la barre latérale sort de l'écran à gauche : le contenu prend toute la largeur.
      const fit = desktop
        ? Math.min(1, (window.innerWidth * 0.58) / 1000, (window.innerHeight * 0.78) / 640)
        : Math.min(1, (window.innerWidth - 16) / 800, (window.innerHeight * 0.46) / 640);
      const shiftX = desktop ? window.innerWidth * 0.16 : -100 * fit;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const p = total > 0 ? clamp01(-rect.top / total) : 0;
      const intro = smooth(clamp01(p / 0.12));
      const t = clamp01((p - 0.14) / 0.82) * STEPS.length;

      const vars: Record<string, string> = { "--intro": intro.toFixed(4), "--fit": fit.toFixed(4), "--shift-x": `${shiftX.toFixed(1)}px` };
      STEPS.forEach((_, i) => {
        let l = clamp01(1 - Math.max(0, Math.abs(t - (i + 0.5)) - 0.3) * 2.5);
        if (i === 0 && t < 0.5) l = 1;
        if (i === STEPS.length - 1 && t > STEPS.length - 0.5) l = 1;
        vars[`--l${i}`] = l.toFixed(4);
        vars[`--c${i}`] = (l * clamp01((intro - 0.6) / 0.4)).toFixed(4);
        vars[`--s${i}`] = clamp01(t - i).toFixed(4);
      });

      // Couleur d'accent : interpolée entre les étapes.
      const a = Math.min(ACCENTS.length - 1.0001, Math.max(0, t - 0.5));
      const ai = Math.floor(a);
      const af = a - ai;
      const rgb = ACCENTS[ai]!.map((c, k) => Math.round(c + (ACCENTS[ai + 1]![k]! - c) * af));
      vars["--acc-rgb"] = rgb.join(" ");

      const key = Object.values(vars).join("|");
      if (key !== last) {
        last = key;
        for (const [k, val] of Object.entries(vars)) el.style.setProperty(k, val);
      }

      // Le titre disparu ne doit plus recevoir le focus ni les clics.
      hero.current?.toggleAttribute("inert", intro > 0.55);

      // Analyse : la courbe se déforme de 1 an à 5 ans.
      const u = clamp01(t - 1) * 2;
      const values = seriesAt(u);
      const pts = chartPoints(values);
      const d = smoothPath(pts);
      line.current?.setAttribute("d", d);
      area.current?.setAttribute("d", `${d} L${CHART.w} ${CHART.h} L0 ${CHART.h} Z`);
      ask.current?.setAttribute("d", smoothPath(chartPoints(values.map((x, k) => x * ASKING[k]!))));
      if (growth.current) growth.current.textContent = `+${Math.round((values[values.length - 1]! / values[0]! - 1) * 100)} %`;
      const active = Math.round(u);
      periods.current.forEach((span, i) => span.toggleAttribute("data-active", i === active));

      // Acquéreurs : le compteur suit les lignes qui apparaissent.
      if (matches.current) matches.current.textContent = String(Math.max(1, Math.min(4, Math.ceil(clamp01(t - 2) * 4.4))));
      // Mandats : les jours restants décomptent pendant que l'anneau se remplit.
      if (days.current) days.current.textContent = `${Math.round(90 - 78 * clamp01(t - 3))} j`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <section ref={root} className="story" aria-labelledby="titre-accueil">
      <div className="story-stage">
        <div aria-hidden="true" className="glow glow-a" />
        <div aria-hidden="true" className="glow glow-b" />
        <div aria-hidden="true" className="glow glow-c" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />

        {/* Titre d'accueil : il s'efface (flou, montée) quand la fenêtre prend la place. */}
        <div ref={hero} className="story-hero relative z-10 mx-auto max-w-4xl px-5 pt-[15svh] text-center sm:pt-[17svh]">
          <p className="hero-in inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[13px] text-white/80" style={v({ "--rise": "0px" })}>
            <span className="size-1.5 rounded-full bg-[rgb(var(--acc-rgb))]" />
            Pour les agences immobilières indépendantes
          </p>
          <h1 id="titre-accueil" className="mt-6 font-display text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.04em] text-balance sm:text-6xl lg:text-[5rem]">
            <span className="hero-in block" style={v({ "--blur": "10px", "--rise": "20px", "--d": "80ms" })}>Toute votre agence,</span>
            <span className="hero-in block" style={v({ "--blur": "10px", "--rise": "20px", "--d": "170ms" })}>
              <span className="font-serif-italic text-[1.12em] text-[#ffb79e]">dans un seul outil.</span>
            </span>
          </h1>
          <p className="hero-in mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg" style={v({ "--d": "280ms", "--rise": "10px" })}>
            Carte des biens, analyse du marché, clients et mandats, avec des agents qui préparent le travail. Dans le navigateur, sans
            installation.
          </p>
          <div className="hero-in mt-8 flex flex-wrap justify-center gap-3" style={v({ "--d": "360ms", "--rise": "8px" })}>
            <Link href={cta.href} className="press inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-medium text-[#1c1411] shadow-[0_10px_40px_-10px_rgb(var(--acc-rgb)/0.8)] hover:bg-white/90">
              {cta.label}
              <SiteIcon name="arrow" className="arrow size-4" strokeWidth={2} />
            </Link>
            <a href="#tarifs" className="press inline-flex h-12 items-center rounded-full border border-white/20 bg-white/[0.06] px-6 text-[15px] font-medium text-white hover:bg-white/[0.12]">
              Voir les tarifs
            </a>
          </div>
          <p className="hero-in mt-5 text-[13px] text-white/65" style={v({ "--d": "420ms", "--rise": "0px" })}>
            14 jours gratuits <span aria-hidden="true">·</span> sans carte bancaire <span aria-hidden="true">·</span> sans engagement
          </p>
        </div>

        {/* La fenêtre du logiciel (maquette décorative). */}
        <div className="story-window" aria-hidden="true">
          <div className="light-on glass flex size-full overflow-hidden rounded-[28px] text-[#1c1411] shadow-[0_60px_120px_-40px_rgb(0_0_0/0.7),0_0_0_1px_rgb(255_255_255/0.1)]">
            <WindowMock refs={{ area, line, ask, growth, days, matches, periods }} />
          </div>
        </div>

        {/* Légendes des étapes : elles se remplacent en fondu. */}
        <div className="story-caps pointer-events-none absolute inset-x-5 top-24 grid lg:inset-x-auto lg:left-[6vw] lg:top-1/2 lg:w-[min(30vw,400px)] lg:-translate-y-1/2">
          {STEPS.map((s, i) => (
            <div key={s.label} className="story-cap" style={v({ "--c": `var(--c${i})` })}>
              <p className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.2em] text-[#ffb79e]">
                <span className="size-1.5 rounded-full bg-[#ffb79e]" />
                Étape {i + 1}/4 · {s.label}
              </p>
              <h2 className="mt-3 font-display text-[1.7rem] font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-4xl lg:text-[2.6rem]">{s.title}</h2>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/75 sm:text-base">{s.text}</p>
            </div>
          ))}
        </div>

        {/* Avancement : une barre par étape, qui se remplit au défilement. */}
        <div aria-hidden="true" className="story-rail absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2" style={{ opacity: "var(--intro)" }}>
          {STEPS.map((s, i) => (
            <span key={s.label} className="h-1 w-10 overflow-hidden rounded-full bg-white/15 sm:w-14" style={v({ "--s": `var(--s${i})` })}>
              <span className="block h-full rounded-full bg-white/80" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

type MockRefs = {
  area: React.RefObject<SVGPathElement | null>;
  line: React.RefObject<SVGPathElement | null>;
  ask: React.RefObject<SVGPathElement | null>;
  growth: React.RefObject<HTMLSpanElement | null>;
  days: React.RefObject<HTMLSpanElement | null>;
  matches: React.RefObject<HTMLSpanElement | null>;
  periods: React.RefObject<HTMLSpanElement[]>;
};

const NAV: { icon: SiteIconName; label: string; step?: number }[] = [
  { icon: "visit", label: "Ma journée" },
  { icon: "map", label: "Carte", step: 0 },
  { icon: "chart", label: "Analyse", step: 1 },
  { icon: "target", label: "Acquéreurs", step: 2 },
  { icon: "key", label: "Mandats", step: 3 },
  { icon: "contacts", label: "Contacts" },
  { icon: "calendar", label: "Agenda" },
  { icon: "bot", label: "Agents" },
];

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-[#1c1411]/10 bg-white/60 px-2 py-0.5 text-[10px] font-medium text-[#5a4a42]">{children}</span>;
}

function WindowMock({ refs }: { refs: MockRefs }) {
  return (
    <>
      {/* Barre latérale : l'élément actif suit l'étape. */}
      <div className="flex w-[200px] shrink-0 flex-col gap-1 border-r border-white/50 bg-white/25 p-4">
        <div className="mb-4 flex items-center gap-2">
          <LogoMark className="size-7 text-[#1c1411]" />
          <span className="text-[13px] font-semibold">ImmoPilot</span>
        </div>
        {NAV.map((n) => (
          <div key={n.label} className="relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] text-[#3d302a]">
            {n.step !== undefined ? (
              <span className="story-nav-pill absolute inset-0 rounded-xl bg-white shadow-[0_4px_14px_-6px_rgb(0_0_0/0.25)]" style={v({ "--l": `var(--l${n.step})` })} />
            ) : null}
            <SiteIcon name={n.icon} className="relative size-4" />
            <span className="relative">{n.label}</span>
          </div>
        ))}
        <div className="mt-auto flex items-center gap-2 rounded-xl bg-white/40 p-2">
          <span className="flex size-7 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ background: "color-mix(in srgb, rgb(var(--acc-rgb)) 65%, black)" }}>
            AD
          </span>
          <span className="text-[11px] leading-tight">
            <span className="block font-medium">Agence du Port</span>
            <span className="text-[#5a4a42]">Gérante</span>
          </span>
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[#5a4a42]">Lundi 23 novembre</p>
            <p className="font-display text-[22px] font-semibold tracking-tight">Bonjour, Agence du Port</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 rounded-full border border-[#1c1411]/10 bg-white/60 px-3 py-1.5 text-[11px] text-[#5a4a42]">
              <span className="rounded bg-[#1c1411]/10 px-1 font-mono text-[10px]">⌘K</span> Rechercher un bien, un contact…
            </span>
            <Chip>Exemple</Chip>
          </div>
        </div>

        <div className="relative mt-4 flex-1">
          <MapLayer />
          <AnalysisLayer refs={refs} />
          <BuyersLayer matches={refs.matches} />
          <MandatesLayer days={refs.days} />
        </div>
      </div>
    </>
  );
}

const PINS = [
  { x: 16, y: 22, label: "189 000 €" },
  { x: 50, y: 14, label: "245 000 €" },
  { x: 70, y: 52, label: "312 000 €" },
  { x: 82, y: 24, label: "158 000 €" },
  { x: 34, y: 70, label: "276 000 €" },
];
const SALES = [[40, 36], [47, 50], [58, 40], [52, 66], [36, 46], [63, 54], [44, 28], [56, 58], [31, 56], [60, 30]] as const;

function MapLayer() {
  return (
    <div className="story-layer overflow-hidden rounded-2xl border border-white/70 bg-[#f1e9df]" style={v({ "--l": "var(--l0)" })}>
      <svg viewBox="0 0 760 480" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <rect x="470" y="300" width="210" height="140" rx="22" fill="#dce8d2" />
        <rect x="60" y="40" width="150" height="90" rx="18" fill="#dce8d2" />
        <path d="M-20 360 C 160 320, 260 420, 430 380 S 680 300, 790 330" stroke="#c9dcec" strokeWidth="34" fill="none" />
        <path d="M0 140 H760 M0 270 H760 M230 0 V480 M500 0 V480" stroke="#ffffff" strokeWidth="14" />
        <path d="M0 70 H760 M0 205 H760 M0 430 H760 M100 0 V480 M360 0 V480 M630 0 V480 M0 0 L760 480" stroke="#ffffff" strokeWidth="6" opacity="0.8" />
        <circle cx="365" cy="230" r="150" className="scrub-radius" fill="rgb(var(--acc-rgb))" fillOpacity="0.1" stroke="rgb(var(--acc-rgb))" strokeWidth="2" strokeDasharray="7 8" />
      </svg>
      {SALES.map(([x, y], i) => (
        <span key={i} className="scrub absolute size-2.5 rounded-full border-2 border-white bg-[#3b82c4]" style={{ left: `${x}%`, top: `${y}%`, ...v({ "--sp": "var(--s0)", "--k": (0.08 + i * 0.05).toFixed(2) }) }} />
      ))}
      {PINS.map((p) => (
        <span key={p.label} className="absolute -translate-x-1/2 rounded-full bg-[#1c1411] px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
          {p.label}
        </span>
      ))}
      <span className="scrub absolute left-[47%] top-[44%] -translate-x-1/2 rounded-full bg-[#1c1411] px-3 py-1.5 text-[12px] font-semibold text-white shadow-xl ring-4 ring-[rgb(var(--acc-rgb)/0.35)]" style={v({ "--sp": "var(--s0)", "--k": "0.55" })}>
        Bonne affaire · −12 %
      </span>
      <div className="absolute bottom-3 left-3 flex gap-3 rounded-full bg-white/80 px-3 py-1.5 text-[11px] text-[#3d302a] backdrop-blur">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#1c1411]" />Vos biens</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#3b82c4]" />Ventes réelles</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full border border-dashed border-[rgb(var(--acc-rgb))]" />Rayon de recherche</span>
      </div>
    </div>
  );
}

function AnalysisLayer({ refs }: { refs: MockRefs }) {
  return (
    <div className="story-layer grid grid-rows-[auto_1fr] gap-3" style={v({ "--l": "var(--l1)" })}>
      <div className="grid grid-cols-[1.35fr_1fr_1fr] gap-3">
        <div className="rounded-2xl p-4 text-white shadow-[0_20px_40px_-20px_rgb(var(--acc-rgb))]" style={{ background: "linear-gradient(135deg, color-mix(in srgb, rgb(var(--acc-rgb)) 72%, black), color-mix(in srgb, rgb(var(--acc-rgb)) 55%, black))" }}>
          <p className="text-[11px] text-white/85">T3 · 68 m² · rue Delpech</p>
          <p className="mt-1 font-display text-[26px] font-semibold tracking-tight">199 000 €</p>
          <p className="mt-1 text-[13px]">
            <span className="font-serif-italic text-[17px]">Bonne affaire</span> · 12 % sous la fourchette
          </p>
          <div className="relative mt-3 h-1.5 rounded-full bg-white/25">
            <span className="scrub-bar absolute inset-y-0 left-[37%] w-[43%] rounded-full bg-white/70" style={v({ "--sp": "var(--s1)", "--k": "0" })} />
            <span className="absolute -top-1 left-[15%] h-3.5 w-1 rounded-full bg-white" />
          </div>
        </div>
        {[
          ["Rendement brut", "5,9 – 6,5 %"],
          ["Risques recensés", "3"],
        ].map(([k, val]) => (
          <div key={k} className="rounded-2xl border border-white/70 bg-white/55 p-4">
            <p className="text-[11px] text-[#5a4a42]">{k}</p>
            <p className="mt-2 font-display text-[22px] font-semibold tracking-tight">{val}</p>
          </div>
        ))}
      </div>
      <div className="flex min-h-0 flex-col rounded-2xl border border-white/70 bg-white/55 p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] font-semibold">Prix au m² du quartier</p>
            <p className="text-[11px] text-[#5a4a42]">
              Ventes réelles <span ref={refs.growth} className="font-semibold text-[#1c1411]">+11 %</span> · prix demandés en pointillés
            </p>
          </div>
          <div className="flex gap-1 rounded-full bg-[#1c1411]/[0.06] p-1">
            {PERIODS.map((label, i) => (
              <span
                key={label}
                ref={(node) => {
                  if (node) refs.periods.current[i] = node;
                }}
                data-active={i === 0 ? "" : undefined}
                className="rounded-full px-2.5 py-1 text-[11px] text-[#5a4a42] transition-colors duration-300 data-active:bg-[#1c1411] data-active:text-white"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        <svg viewBox={`0 0 ${CHART.w} ${CHART.h}`} preserveAspectRatio="none" className="mt-3 min-h-0 w-full flex-1 overflow-visible">
          <defs>
            <linearGradient id="story-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--acc-rgb))" stopOpacity="0.45" />
              <stop offset="100%" stopColor="rgb(var(--acc-rgb))" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={CHART.w} y1={CHART.h * f} y2={CHART.h * f} stroke="#1c1411" strokeOpacity="0.07" />
          ))}
          <path ref={refs.area} d={INITIAL_AREA} fill="url(#story-area)" />
          <path ref={refs.ask} d={INITIAL_ASK} fill="none" stroke="#1c1411" strokeOpacity="0.55" strokeWidth="1.6" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
          <path ref={refs.line} d={INITIAL_LINE} fill="none" stroke="rgb(var(--acc-rgb))" strokeWidth="2.6" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
  );
}

const BUYERS = [
  { initials: "CM", name: "Claire M.", wish: "T3 · Amiens centre · jusqu'à 230 000 €", score: 94, agent: "Léa" },
  { initials: "JP", name: "Julien et Sarah P.", wish: "3 à 4 pièces · balcon · près des écoles", score: 86, agent: "Hugo" },
  { initials: "IN", name: "Investisseur", wish: "Rendement supérieur à 5,5 %", score: 78, agent: "Léa" },
  { initials: "MB", name: "Martine B.", wish: "T3 rénové · ascenseur", score: 71, agent: "Nora" },
];

function BuyersLayer({ matches }: { matches: React.RefObject<HTMLSpanElement | null> }) {
  return (
    <div className="story-layer rounded-2xl border border-white/70 bg-white/55 p-5" style={v({ "--l": "var(--l2)" })}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-[#5a4a42]">Nouveau bien · T3 · 68 m² · rue Delpech</p>
          <p className="font-display text-[22px] font-semibold tracking-tight">
            <span ref={matches}>1</span> acquéreurs correspondent
          </p>
        </div>
        <span className="rounded-full bg-[#1c1411] px-3 py-1.5 text-[11px] font-medium text-white">Collègues prévenus</span>
      </div>
      <div className="mt-4 space-y-2.5">
        {BUYERS.map((b, i) => (
          <div key={b.name} className="scrub flex items-center gap-3 rounded-xl border border-white/80 bg-white/70 px-3.5 py-3" style={v({ "--sp": "var(--s2)", "--k": (0.02 + i * 0.2).toFixed(2) })}>
            <span className="flex size-9 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ background: "color-mix(in srgb, rgb(var(--acc-rgb)) 70%, black)" }}>
              {b.initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">{b.name}</span>
              <span className="block truncate text-[11px] text-[#5a4a42]">{b.wish}</span>
            </span>
            <span className="text-[11px] text-[#5a4a42]">Suivi par {b.agent}</span>
            <span className="w-24">
              <span className="flex justify-between text-[11px]">
                <span className="text-[#5a4a42]">Accord</span>
                <span className="font-semibold">{b.score} %</span>
              </span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#1c1411]/10">
                <span className="scrub-bar block h-full rounded-full bg-[rgb(var(--acc-rgb))]" style={{ width: `${b.score}%`, ...v({ "--sp": "var(--s2)", "--k": (0.05 + i * 0.2).toFixed(2) }) }} />
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const AGENT_NOTES: { icon: SiteIconName; who: string; text: string; status: string }[] = [
  { icon: "key", who: "Veille des mandats", text: "3 mandats arrivent à échéance d'ici 30 jours. Rappels aux vendeurs préparés.", status: "À valider" },
  { icon: "deal", who: "Suivi des affaires", text: "Compromis rue Delpech : la condition de prêt expire dans 9 jours.", status: "Rappel" },
  { icon: "contacts", who: "Qualité des données", text: "2 contacts en double. Fusion proposée, rien n'est fait sans votre accord.", status: "À valider" },
];

function MandatesLayer({ days }: { days: React.RefObject<HTMLSpanElement | null> }) {
  return (
    <div className="story-layer grid grid-cols-[1fr_1.25fr] gap-3" style={v({ "--l": "var(--l3)" })}>
      <div className="flex flex-col rounded-2xl border border-white/70 bg-white/55 p-5">
        <p className="text-[13px] font-semibold">Mandat exclusif n° 2026-031</p>
        <p className="text-[11px] text-[#5a4a42]">Échéance du mandat</p>
        <div className="relative mx-auto my-4 size-40">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#1c1411" strokeOpacity="0.08" strokeWidth="10" />
            <circle cx="60" cy="60" r="50" fill="none" stroke="rgb(var(--acc-rgb))" strokeWidth="10" strokeLinecap="round" pathLength={1} strokeDasharray="1" className="scrub-ring" />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span ref={days} className="font-display text-[34px] font-semibold tracking-tight">90 j</span>
            <span className="text-[11px] text-[#5a4a42]">restants</span>
          </span>
        </div>
        <div className="mt-auto space-y-1.5">
          {[
            ["Offre acceptée", true],
            ["Compromis signé", true],
            ["Prêt obtenu", false],
            ["Acte authentique", false],
          ].map(([step, done]) => (
            <div key={String(step)} className="flex items-center gap-2 text-[12px]">
              <span className={done ? "flex size-4 items-center justify-center rounded-full bg-[#1c1411] text-white" : "size-4 rounded-full border border-[#1c1411]/30"}>
                {done ? <SiteIcon name="check" className="size-2.5" strokeWidth={3} /> : null}
              </span>
              <span className={done ? "" : "text-[#5a4a42]"}>{String(step)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <p className="px-1 text-[12px] text-[#5a4a42]">Ce matin, vos agents ont préparé :</p>
        {AGENT_NOTES.map((n, i) => (
          <div key={n.who} className="scrub flex gap-3 rounded-2xl border border-white/80 bg-white/70 p-4" style={v({ "--sp": "var(--s3)", "--k": (0.12 + i * 0.24).toFixed(2) })}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1c1411] text-white">
              <SiteIcon name={n.icon} className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between">
                <span className="text-[13px] font-semibold">{n.who}</span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: "color-mix(in srgb, rgb(var(--acc-rgb)) 70%, black)" }}>
                  {n.status}
                </span>
              </span>
              <span className="mt-1 block text-[12px] leading-relaxed text-[#3d302a]">{n.text}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
