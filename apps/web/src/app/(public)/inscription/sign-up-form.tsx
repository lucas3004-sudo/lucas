"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import { buttonClass } from "@/ui/button";
import { Field, Input } from "@/ui/form";
import { Alert } from "@/ui/surface";

export function SignUpForm({ invitation }: { invitation?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (password.length < 12) {
      setError("Le mot de passe doit contenir au moins 12 caractères.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: signUpError } = await authClient.signUp.email({
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      password,
    });
    if (signUpError) {
      setError(authErrorMessage(signUpError));
      setPending(false);
      return;
    }
    router.replace(invitation ? `/invitation/${encodeURIComponent(invitation)}` : "/agence/nouvelle");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Field label="Nom et prénom" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" required minLength={2} />
      </Field>
      <Field label="Adresse e-mail professionnelle" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Mot de passe" htmlFor="password" hint="12 caractères au minimum.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} />
      </Field>
      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "Création du compte…" : "Créer mon compte"}
      </button>
    </form>
  );
}
