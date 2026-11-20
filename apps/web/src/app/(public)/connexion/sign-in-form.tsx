"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { enterAppAction } from "@/lib/agency/actions";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import { buttonClass } from "@/ui/button";
import { Field, Input } from "@/ui/form";
import { Alert } from "@/ui/surface";

export function SignInForm({ invitation }: { invitation?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.email({
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
    });
    if (signInError) {
      setError(authErrorMessage(signInError));
      setPending(false);
      return;
    }
    router.replace(invitation ? `/invitation/${encodeURIComponent(invitation)}` : await enterAppAction());
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Field label="Adresse e-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Mot de passe" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
