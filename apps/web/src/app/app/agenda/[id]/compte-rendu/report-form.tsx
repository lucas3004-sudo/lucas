"use client";
import { INTEREST_LABELS, NEXT_STEP_LABELS, PRICE_OPINION_LABELS } from "@immopilot/domain";
import type { ActionState } from "@/lib/agency/actions";
import { saveVisitReportAction } from "@/lib/visits/actions";
import { ActionForm, SubmitButton } from "@/ui/client";
import { Field, Textarea } from "@/ui/form";
import { Alert } from "@/ui/surface";

type Initial = {
  interest: string;
  priceOpinion: string;
  nextStep: string;
  positives: string;
  objections: string;
};

function Choices({ legend, name, options, value, required }: { legend: string; name: string; options: Record<string, string>; value: string; required?: boolean }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-[13px] font-medium text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {Object.entries(options).map(([key, label]) => (
          <label key={key} className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input type="radio" name={name} value={key} defaultChecked={value === key} required={required} className="size-4 accent-brand" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function VisitReportForm({ appointmentId, initial, editing }: { appointmentId: string; initial: Initial; editing: boolean }) {
  return (
    <ActionForm<ActionState> action={saveVisitReportAction} initial={{}} className="space-y-5 px-5 py-5">
      {(state) => (
        <>
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
          {state.success ? <Alert tone="success">{state.success}</Alert> : null}
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <Choices legend="Intérêt des visiteurs" name="interest" options={INTEREST_LABELS} value={initial.interest} required />
          <Choices legend="Avis sur le prix (facultatif)" name="priceOpinion" options={{ "": "Pas d'avis", ...PRICE_OPINION_LABELS }} value={initial.priceOpinion} />
          <Choices legend="Suite envisagée" name="nextStep" options={NEXT_STEP_LABELS} value={initial.nextStep} required />
          <Field label="Points appréciés" htmlFor="positives" hint="Repris tels quels dans le texte pour le vendeur.">
            <Textarea id="positives" name="positives" rows={3} maxLength={2000} defaultValue={initial.positives} />
          </Field>
          <Field label="Réserves exprimées" htmlFor="objections" hint="N'y écrivez pas le nom des visiteurs : le compte rendu est destiné au vendeur.">
            <Textarea id="objections" name="objections" rows={3} maxLength={2000} defaultValue={initial.objections} />
          </Field>
          <SubmitButton pendingLabel="Enregistrement…">{editing ? "Mettre à jour le compte rendu" : "Enregistrer le compte rendu"}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
