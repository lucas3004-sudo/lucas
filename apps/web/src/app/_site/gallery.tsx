"use client";
/**
 * Vraies captures du logiciel, qui glissent de côté et pivotent légèrement pendant qu'on
 * descend (la progression de la section dans l'écran pilote la variable --g).
 */
import { useEffect, useRef } from "react";

const SHOTS = [
  { src: "/accueil/carte.jpg", w: 1440, h: 1000, alt: "Carte des biens d'ImmoPilot : biens de l'agence avec leur prix, ventes réelles autour et liste filtrée à côté", label: "Carte des biens" },
  { src: "/accueil/fiche.jpg", w: 1440, h: 1053, alt: "Fiche d'un bien avec son analyse du marché : fourchette de prix, médiane de la commune, rendement locatif et risques", label: "Fiche du bien et analyse du marché" },
];

export function ScrollGallery() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const g = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight + r.height)));
      el.style.setProperty("--g", g.toFixed(4));
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
    <div ref={root} className="gallery overflow-x-clip py-4">
      <div className="gallery-track flex items-center justify-center gap-6 px-4 sm:gap-10">
        {SHOTS.map((s) => (
          <figure key={s.src} className="gallery-shot w-[86vw] shrink-0 md:w-[54vw] lg:w-[46vw]">
            <div className="glass rounded-[26px] p-2 shadow-[0_40px_80px_-40px_rgb(60_30_20/0.45)]">
              <img src={s.src} alt={s.alt} width={s.w} height={s.h} loading="lazy" className="w-full rounded-[18px]" />
            </div>
            <figcaption className="mt-3 text-center text-sm text-s-muted">{s.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
