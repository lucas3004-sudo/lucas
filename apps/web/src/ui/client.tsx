"use client";
/** Composants interactifs du design system (nécessitent le navigateur). */
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "./button";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass(variant, size, className)}>
      {pending ? (pendingLabel ?? "Un instant…") : children}
    </button>
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
