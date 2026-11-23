"use client";
/** Conversation avec l'assistant IA : questions sur ImmoPilot et sur les données de l'agence. */
import { useActionState, useEffect, useRef } from "react";
import { askAssistantAction, type ChatState } from "@/lib/ai/actions";
import { SubmitButton } from "@/ui/client";
import { Textarea } from "@/ui/form";
import { cn } from "@/ui/cn";

const SUGGESTIONS = ["Comment baisser le prix d'un bien ?", "Quels biens sont sous mandat en ce moment ?", "Comment importer mes contacts depuis Excel ?"];

export function AssistantChat({ disabled }: { disabled: boolean }) {
  const [state, action] = useActionState<ChatState, FormData>(askAssistantAction, { turns: [] });
  const form = useRef<HTMLFormElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.turns.length) {
      form.current?.reset();
      end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [state.turns.length]);

  return (
    <div className="flex flex-col gap-4">
      <div role="log" aria-live="polite" aria-label="Conversation avec l'assistant" className="space-y-3">
        {state.turns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-5 py-6 text-sm text-ink-muted">
            Posez une question sur l&apos;utilisation d&apos;ImmoPilot ou sur les biens de l&apos;agence. Par exemple :
            <ul className="mt-2 space-y-1">
              {SUGGESTIONS.map((s) => (
                <li key={s} className="text-ink">« {s} »</li>
              ))}
            </ul>
          </div>
        ) : null}
        {state.turns.map((t, i) => (
          <div key={i} className={cn("pop-in flex", t.role === "user" ? "justify-end" : "justify-start")}>
            <p
              className={cn(
                "max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                t.role === "user" ? "bg-ink text-canvas" : "border border-line bg-surface text-ink shadow-[var(--shadow-card)]",
              )}
            >
              <span className="sr-only">{t.role === "user" ? "Vous : " : "Assistant : "}</span>
              {t.text}
            </p>
          </div>
        ))}
        <div ref={end} />
      </div>
      {state.error ? (
        <p role="alert" className="pop-in rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">{state.error}</p>
      ) : null}
      <form ref={form} action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="history" value={JSON.stringify(state.turns)} />
        <label htmlFor="question" className="sr-only">Votre question</label>
        <Textarea id="question" name="question" required minLength={2} maxLength={2000} disabled={disabled} placeholder="Votre question…" className="min-h-12 flex-1 rounded-2xl" />
        <SubmitButton disabled={disabled} pendingLabel="L'assistant réfléchit…">Envoyer</SubmitButton>
      </form>
    </div>
  );
}
