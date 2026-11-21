"use client";
import type { CrmState } from "@/lib/crm/actions";
import { updateMandateAction } from "@/lib/crm/mandate-actions";
import { ActionForm, SubmitButton } from "@/ui/client";
import { Field, Input, Select } from "@/ui/form";
import { Alert } from "@/ui/surface";

export function MandateForm({ propertyId, initial }: {
  propertyId: string;
  initial: { mandateType: string; mandateNumber: string; signedOn: string; endsOn: string };
}) {
  return (
    <ActionForm action={updateMandateAction} initial={{} as CrmState} className="space-y-4 px-5 py-4">
      {(state) => (
        <>
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
          {state.success ? <Alert tone="success">{state.success}</Alert> : null}
          <input type="hidden" name="id" value={propertyId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type de mandat" htmlFor="mandateType">
              <Select id="mandateType" name="mandateType" defaultValue={initial.mandateType}>
                <option value="">Non précisé</option>
                <option value="simple">Simple</option>
                <option value="exclusif">Exclusif</option>
              </Select>
            </Field>
            <Field label="Numéro de mandat" htmlFor="mandateNumber" hint="Celui de votre registre des mandats.">
              <Input id="mandateNumber" name="mandateNumber" maxLength={30} defaultValue={initial.mandateNumber} />
            </Field>
            <Field label="Signé le" htmlFor="signedOn">
              <Input id="signedOn" name="signedOn" type="date" defaultValue={initial.signedOn} />
            </Field>
            <Field label="Fin du mandat" htmlFor="endsOn" hint="Rappel 30 jours avant.">
              <Input id="endsOn" name="endsOn" type="date" defaultValue={initial.endsOn} />
            </Field>
          </div>
          <SubmitButton variant="secondary" pendingLabel="Enregistrement…">Enregistrer le mandat</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
