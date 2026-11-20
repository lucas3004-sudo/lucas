"use client";
import { useActionState } from "react";
import { createAgencyAction, type ActionState } from "@/lib/agency/actions";
import { SubmitButton } from "@/ui/client";
import { Field, Input } from "@/ui/form";
import { Alert } from "@/ui/surface";

export function CreateAgencyForm() {
  const [state, action] = useActionState<ActionState, FormData>(createAgencyAction, {});
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field label="Nom de l'agence" htmlFor="name" hint="Tel qu'il apparaîtra pour votre équipe. Modifiable plus tard.">
        <Input id="name" name="name" required minLength={2} maxLength={80} autoComplete="organization" />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Création…">
        Créer l&apos;agence
      </SubmitButton>
    </form>
  );
}
