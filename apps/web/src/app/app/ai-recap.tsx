"use client";
/** Bouton « Résumer avec l'IA » du récap (D-069) : le texte s'affiche sous le bouton. */
import { useActionState } from "react";
import { aiRecapAction, type AiRecapState } from "@/lib/recap/ai-actions";
import { SubmitButton } from "@/ui/client";

export function AiRecap({ period }: { period: "jour" | "semaine" }) {
  const [state, action] = useActionState<AiRecapState, FormData>(aiRecapAction, {});
  return (
    <div className="border-t border-line px-5 py-3">
      {state.text ? (
        <div className="space-y-1" aria-live="polite">
          <p className="whitespace-pre-line text-sm text-ink" data-testid="recap-ia">{state.text}</p>
          <p className="text-xs text-ink-subtle">Résumé rédigé par l&apos;IA à partir des chiffres ci-dessus.</p>
        </div>
      ) : (
        <form action={action} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="period" value={period} />
          <SubmitButton size="sm" variant="secondary" pendingLabel="Rédaction…">Résumer avec l&apos;IA</SubmitButton>
          {state.error ? <p className="text-xs text-ink-muted" role="status">{state.error}</p> : null}
        </form>
      )}
    </div>
  );
}
