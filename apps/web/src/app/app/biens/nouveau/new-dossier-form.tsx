"use client";
import { useActionState } from "react";
import type { ActionState } from "@/lib/agency/actions";
import { createDossierAction } from "@/lib/dossier/actions";
import { AddressField } from "@/ui/address-field";
import { SubmitButton } from "@/ui/client";
import { Field, Input, Select } from "@/ui/form";
import { Alert } from "@/ui/surface";

export interface DossierDefaults {
  address: { label: string; banId: string } | null;
  type: "Appartement" | "Maison";
  surface: string;
  rooms: string;
}

export function NewDossierForm({ defaults }: { defaults: DossierDefaults }) {
  const [state, action] = useActionState<ActionState, FormData>(createDossierAction, {});
  return (
    <form action={action} className="space-y-5 px-5 py-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <AddressField defaultValue={defaults.address} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Type de bien" htmlFor="type">
          <Select id="type" name="type" defaultValue={defaults.type}>
            <option value="Appartement">Appartement</option>
            <option value="Maison">Maison</option>
          </Select>
        </Field>
        <Field label="Surface habitable (m²)" htmlFor="surface">
          <Input id="surface" name="surface" type="number" inputMode="decimal" min={9} max={2000} step="0.1" required defaultValue={defaults.surface} />
        </Field>
        <Field label="Pièces principales" htmlFor="rooms" hint="Facultatif">
          <Input id="rooms" name="rooms" type="number" inputMode="numeric" min={1} max={30} defaultValue={defaults.rooms} />
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
