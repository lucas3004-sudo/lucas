"use client";
/** Carrousel des photos d'un bien : flèches, clavier (← →), glissement du doigt, vignettes. */
import { useRef, useState } from "react";
import { cn } from "@/ui/cn";

export function PhotoCarousel({ photos, label }: { photos: { id: string }[]; label: string }) {
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  if (!photos.length) {
    return (
      <div className="flex aspect-[16/10] w-full items-center justify-center rounded-[var(--radius-card)] border border-line bg-surface-muted text-sm text-ink-muted">
        Aucune photo pour ce bien.
      </div>
    );
  }
  const go = (delta: number) => setIndex((i) => (i + delta + photos.length) % photos.length);
  const current = photos[index]!;
  return (
    <div className="space-y-2">
      <div
        role="region"
        aria-roledescription="carrousel"
        aria-label={`Photos du bien ${label}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
        onPointerDown={(e) => (startX.current = e.clientX)}
        onPointerUp={(e) => {
          if (startX.current === null) return;
          const dx = e.clientX - startX.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          startX.current = null;
        }}
        className="group relative aspect-[16/10] w-full touch-pan-y select-none overflow-hidden rounded-[var(--radius-card)] bg-black"
      >
        <img src={`/api/v1/photos/${current.id}`} alt={`Photo ${index + 1} sur ${photos.length}`} className="h-full w-full object-contain" draggable={false} />
        {photos.length > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Photo précédente" className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-[#111827] shadow">
              ‹
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Photo suivante" className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-[#111827] shadow">
              ›
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-0.5 text-xs text-white" aria-live="polite">
              {index + 1} / {photos.length}
            </span>
          </>
        ) : null}
      </div>
      {photos.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Vignettes">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Afficher la photo ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              className={cn("h-16 w-24 shrink-0 overflow-hidden rounded-md border-2", i === index ? "border-brand" : "border-transparent opacity-70 hover:opacity-100")}
            >
              <img src={`/api/v1/photos/${p.id}`} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
