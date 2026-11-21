"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { enterAppAction } from "@/lib/agency/actions";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import { buttonClass } from "@/ui/button";
import { Field, Input } from "@/ui/form";
import { Alert } from "@/ui/surface";

export function VerifyForm({ invitation }: { invitation?: string }) {
  const router = useRouter();
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    setPending(true);
    setError(null);
    const { error: verifyError } = backup
      ? await authClient.twoFactor.verifyBackupCode({ code })
      : await authClient.twoFactor.verifyTotp({ code });
    if (verifyError) {
      setError(authErrorMessage(verifyError));
      setPending(false);
      return;
    }
    router.replace(invitation ? `/invitation/${encodeURIComponent(invitation)}` : await enterAppAction());
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Field label={backup ? "Code de secours" : "Code de vérification"} htmlFor="code">
        <Input
          id="code"
          name="code"
          inputMode={backup ? "text" : "numeric"}
          autoComplete="one-time-code"
          required
          autoFocus
          maxLength={backup ? 20 : 6}
          pattern={backup ? undefined : "[0-9]{6}"}
        />
      </Field>
      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "Vérification…" : "Valider"}
      </button>
      <div className="flex justify-between text-sm">
        <button type="button" className="font-medium text-brand-text hover:underline" onClick={() => { setBackup(!backup); setError(null); }}>
          {backup ? "Utiliser l'application" : "Utiliser un code de secours"}
        </button>
        <Link href="/connexion" className="text-ink-muted hover:underline">Recommencer</Link>
      </div>
    </form>
  );
}
