"use client";
/** Composants interactifs du design system (nécessitent le navigateur). */
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "./button";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  pending,
  disabled = false,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  /** Nom accessible quand le texte visible ne suffit pas (plusieurs boutons identiques sur la page). */
  "aria-label"?: string;
  pendingLabel?: string;
  /** Bouton inactif (action indisponible). */
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  /** État d'attente fourni par ActionForm (sinon, lu depuis le formulaire parent). */
  pending?: boolean;
}) {
  const status = useFormStatus();
  const busy = pending ?? status.pending;
  return (
    <button type="submit" disabled={busy || disabled} aria-busy={busy} aria-label={ariaLabel} className={buttonClass(variant, size, className)}>
      {busy ? (pendingLabel ?? "Un instant…") : children}
    </button>
  );
}

type ActionResult = { error?: string; success?: string };

/**
 * Formulaire relié à une action serveur, SANS remise à zéro automatique des champs (React 19
 * vide un formulaire après chaque envoi : la saisie serait perdue en cas d'erreur).
 * Les champs ne sont vidés qu'après un succès, si resetOnSuccess est demandé.
 */
export function ActionForm<S extends ActionResult>({
  action,
  initial,
  resetOnSuccess = false,
  className,
  children,
}: {
  action: (prev: S, form: FormData) => Promise<S>;
  initial: S;
  resetOnSuccess?: boolean;
  className?: string;
  children: (state: S, pending: boolean) => ReactNode;
}) {
  const [state, dispatch, pending] = useActionState<S, FormData>(action, initial as Awaited<S>);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state.success) ref.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(data));
  }

  return (
    <form ref={ref} method="post" onSubmit={onSubmit} className={className}>
      {children(state, pending)}
    </form>
  );
}

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        readOnly
        aria-label={label}
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="h-10 min-w-0 flex-1 rounded-[var(--radius-control)] border border-line-strong bg-surface-muted px-3 font-mono text-xs text-ink"
      />
      <button
        type="button"
        className={buttonClass("secondary", "md")}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copié" : "Copier"}
      </button>
    </div>
  );
}

/** Bouton d'envoi qui demande une confirmation (suppression, action irréversible). */
export function ConfirmSubmit({
  message,
  children,
  size = "sm",
  ariaLabel,
}: {
  message: string;
  children: ReactNode;
  size?: "sm" | "md";
  /** Nom accessible précis quand plusieurs boutons portent le même texte. */
  ariaLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label={ariaLabel}
      disabled={pending}
      className={buttonClass("danger", size)}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? "Un instant…" : children}
    </button>
  );
}

/** Copie un texte dans le presse-papiers (bouton). */
export function CopyTextButton({ text, label = "Copier le texte" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("primary", "md")}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copié" : label}
    </button>
  );
}
