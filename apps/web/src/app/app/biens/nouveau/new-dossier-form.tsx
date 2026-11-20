"use client";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { ActionState } from "@/lib/agency/actions";
import { createDossierAction } from "@/lib/dossier/actions";
import { SubmitButton } from "@/ui/client";
import { Field, Input, Select } from "@/ui/form";
import { Alert } from "@/ui/surface";

type Suggestion = { label: string; banId: string };

export function NewDossierForm() {
  const [state, action] = useActionState<ActionState, FormData>(createDossierAction, {});
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const listId = useId();
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
        setLookupError(null);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setLookupError("Le service d'adresses ne répond pas. Réessayez dans un instant.");
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
    <form action={action} className="space-y-5 px-5 py-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {lookupError ? <Alert tone="warning">{lookupError}</Alert> : null}

      <Field label="Adresse du bien" htmlFor="address" hint="Choisissez une adresse dans la liste (Base Adresse Nationale).">
        <div className="relative">
          <Input
            id="address"
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Type de bien" htmlFor="type">
          <Select id="type" name="type" defaultValue="Appartement">
            <option value="Appartement">Appartement</option>
            <option value="Maison">Maison</option>
          </Select>
        </Field>
        <Field label="Surface habitable (m²)" htmlFor="surface">
          <Input id="surface" name="surface" type="number" inputMode="decimal" min={9} max={2000} step="0.1" required />
        </Field>
        <Field label="Pièces principales" htmlFor="rooms" hint="Facultatif">
          <Input id="rooms" name="rooms" type="number" inputMode="numeric" min={1} max={30} />
        </Field>
      </div>

      <p className="text-xs text-ink-muted">
        Ces caractéristiques sont <strong>déclarées</strong> : elles ne sont pas vérifiées. L&apos;estimation produite sera
        indicative et ne constitue pas une expertise.
      </p>
      <SubmitButton pendingLabel="Calcul du dossier en cours…">Créer le dossier</SubmitButton>
    </form>
  );
}
