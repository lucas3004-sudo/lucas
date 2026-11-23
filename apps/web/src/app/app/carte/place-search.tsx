"use client";
/** Recherche d'un lieu (commune, rue, adresse) : liste déroulante accessible (motif « combobox »). */
import { useEffect, useId, useRef, useState } from "react";

export type Place = { label: string; type: string; lon: number; lat: number };

const TYPE_LABELS: Record<string, string> = { municipality: "Commune", street: "Rue", housenumber: "Adresse", locality: "Lieu-dit" };

export function PlaceSearch({ value, onChange }: { value: Place | null; onChange: (p: Place | null) => void }) {
  const id = useId();
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function search(q: string) {
    setQuery(q);
    setActive(-1);
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/carte/lieux?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { results: Place[]; error?: string };
        setResults(data.results ?? []);
        setError(data.error ?? "");
        setOpen(true);
      } catch {
        setError("Recherche de lieu indisponible.");
      }
    }, 250);
  }

  function choose(p: Place) {
    onChange(p);
    setQuery(p.label);
    setOpen(false);
  }

  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="block text-[13px] font-medium text-ink">
        Lieu
      </label>
      <div className="mt-1 flex gap-1.5">
        <input
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          placeholder="Ville, quartier, adresse…"
          autoComplete="off"
          value={query}
          onChange={(e) => search(e.target.value)}
          onKeyDown={(e) => {
            if (!open || !results.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
            } else if (e.key === "Enter" && active >= 0) {
              e.preventDefault();
              choose(results[active]!);
            } else if (e.key === "Escape") setOpen(false);
          }}
          className="h-9 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-2.5 text-sm text-ink"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
              setResults([]);
            }}
            className="h-9 shrink-0 rounded-[var(--radius-control)] border border-line-strong px-2.5 text-sm text-ink-muted hover:text-ink"
            aria-label="Effacer le lieu"
          >
            ×
          </button>
        ) : null}
      </div>
      {open ? (
        <ul id={`${id}-list`} role="listbox" aria-label="Lieux trouvés" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-[var(--radius-control)] border border-line bg-surface shadow-[var(--shadow-card)]">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-muted">{error || "Aucun lieu trouvé."}</li>
          ) : (
            results.map((p, i) => (
              <li
                key={`${p.label}-${i}`}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${i === active ? "bg-brand-soft text-brand-text" : "text-ink hover:bg-surface-muted"}`}
              >
                <span className="truncate">{p.label}</span>
                <span className="shrink-0 text-xs text-ink-muted">{TYPE_LABELS[p.type] ?? p.type}</span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
