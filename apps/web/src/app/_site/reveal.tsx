"use client";
/**
 * Apparitions au défilement du site public : chaque bloc [data-reveal] reçoit data-shown la
 * première fois qu'il entre à l'écran (une seule fois : rejouer l'animation à chaque passage
 * gênerait la lecture). Les nombres [data-count] défilent alors jusqu'à leur valeur.
 * Le CSS (site.css) fait le reste ; sans JavaScript ou avec les mouvements réduits, tout est
 * affiché d'emblée, nombres compris.
 */
import { useEffect } from "react";

function countUp(el: HTMLElement) {
  const target = Number(el.dataset.count);
  if (!Number.isFinite(target)) return;
  const start = performance.now();
  const duration = 1400;
  const step = (now: number) => {
    const k = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - k, 4);
    el.textContent = new Intl.NumberFormat("fr-FR").format(Math.round(target * eased));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function RevealOnScroll() {
  useEffect(() => {
    const blocks = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-shown])"));
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const show = (b: HTMLElement) => {
      b.dataset.shown = "";
      if (!still) b.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp);
    };
    if (!("IntersectionObserver" in window)) {
      blocks.forEach(show);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target as HTMLElement);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    blocks.forEach((b) => observer.observe(b));
    return () => observer.disconnect();
  }, []);
  return null;
}
