"use client";
/**
 * Champ d'adresse avec suggestions de la Base Adresse Nationale (route /api/v1/adresses).
 * Produit deux champs cachés, « label » et « banId » : le serveur regéocode toujours l'adresse
 * et vérifie l'identifiant BAN avant de l'enregistrer.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Field, Input } from "./form";
import { Alert } from "./surface";

type Suggestion = { label: string; banId: string };

export function AddressField({
  label = "Adresse du bien",
  defaultValue,
}: {
  label?: string;
  defaultValue?: Suggestion | null;
}) {
  const [query, setQuery] = useState(defaultValue?.label ?? "");
  const [selected, setSelected] = useState<Suggestion | null>(defaultValue ?? null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const inputId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selected || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    const controller = new AbortController();
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/adresses?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        setSuggestions(((await res.json()) as { results: Suggestion[] }).results);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Le service d'adresses ne répond pas. Réessayez dans un instant.");
      }
    }, 250);
    return () => controller.abort();
  }, [query, selected]);

  function choose(s: Suggestion) {
    setSelected(s);
    setQuery(s.label);
    setSuggestions([]);
    setActive(-1);
  }

  return (
    <div className="space-y-2">
      {error ? <Alert tone="warning">{error}</Alert> : null}
      <Field label={label} htmlFor={inputId} hint="Choisissez une adresse dans la liste (Base Adresse Nationale).">
        <div className="relative">
          <Input
            id={inputId}
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            value={query}
            placeholder="Ex. : 12 rue des Jacobins, Amiens"
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            onKeyDown={(e) => {
              if (!suggestions.length) return;
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, suggestions.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(suggestions[active]!); }
            }}
          />
          {suggestions.length > 0 ? (
            <ul id={listId} role="listbox" className="absolute z-10 mt-1 w-full overflow-hidden rounded-[var(--radius-control)] border border-line bg-surface shadow-[var(--shadow-pop)]">
              {suggestions.map((s, i) => (
                <li key={s.banId} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onClick={() => choose(s)}
                    className={`block w-full px-3 py-2 text-left text-sm ${i === active ? "bg-brand-soft text-brand-text" : "text-ink hover:bg-surface-muted"}`}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Field>
      <input type="hidden" name="label" value={selected?.label ?? ""} />
      <input type="hidden" name="banId" value={selected?.banId ?? ""} />
    </div>
  );
}
