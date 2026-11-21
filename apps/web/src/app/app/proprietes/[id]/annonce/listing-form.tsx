"use client";
import type { CrmState } from "@/lib/crm/actions";
import type { Property } from "@/lib/crm/data";
import { updateListingAction } from "@/lib/crm/listing-actions";
import { ActionForm, SubmitButton } from "@/ui/client";
import { Field, Input, Select, Textarea } from "@/ui/form";
import { Alert } from "@/ui/surface";

const CLASSES = ["A", "B", "C", "D", "E", "F", "G"];

function ClassSelect({ id, label, value }: { id: string; label: string; value: string | null }) {
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} name={id} defaultValue={value ?? ""}>
        <option value="">Non renseignée</option>
        {CLASSES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </Select>
    </Field>
  );
}

export function ListingForm({ property }: { property: Property }) {
  const p = property;
  return (
    <ActionForm action={updateListingAction} initial={{} as CrmState} className="space-y-5 px-5 py-5">
      {(state, pending) => (
        <>
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
          {state.success ? <Alert tone="success">{state.success}</Alert> : null}
          <input type="hidden" name="id" value={p.id} />

          <fieldset className="space-y-3">
            <legend className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Texte de l&apos;agent</legend>
            <Field label="Titre" htmlFor="title" hint="Facultatif : sinon, titre construit à partir du type, des pièces, de la surface et de la ville.">
              <Input id="title" name="title" maxLength={120} defaultValue={p.listing_title ?? ""} />
            </Field>
            <Field label="Description" htmlFor="description" hint="Votre texte, repris tel quel. N'y modifiez aucune caractéristique saisie par ailleurs.">
              <Textarea id="description" name="description" maxLength={4000} rows={5} defaultValue={p.listing_description ?? ""} />
            </Field>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Diagnostic de performance énergétique</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <ClassSelect id="dpeClass" label="Classe énergie" value={p.dpe_class} />
              <ClassSelect id="gesClass" label="Classe climat (GES)" value={p.ges_class} />
              <Field label="Dépenses d'énergie : fourchette basse (€ / an)" htmlFor="energyCostLow">
                <Input id="energyCostLow" name="energyCostLow" type="number" inputMode="numeric" min={0} defaultValue={p.energy_cost_low ?? ""} />
              </Field>
              <Field label="Dépenses d'énergie : fourchette haute (€ / an)" htmlFor="energyCostHigh">
                <Input id="energyCostHigh" name="energyCostHigh" type="number" inputMode="numeric" min={0} defaultValue={p.energy_cost_high ?? ""} />
              </Field>
              <Field label="Année de référence des prix de l'énergie" htmlFor="energyCostYear" hint="Indiquée sur le DPE.">
                <Input id="energyCostYear" name="energyCostYear" type="number" inputMode="numeric" min={2015} max={2100} defaultValue={p.energy_cost_year ?? ""} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Copropriété</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Bien en copropriété" htmlFor="isCopro">
                <Select id="isCopro" name="isCopro" defaultValue={p.is_copro === null ? "" : p.is_copro ? "oui" : "non"}>
                  <option value="">Non renseigné</option>
                  <option value="oui">Oui</option>
                  <option value="non">Non</option>
                </Select>
              </Field>
              <Field label="Nombre de lots" htmlFor="coproLots">
                <Input id="coproLots" name="coproLots" type="number" inputMode="numeric" min={1} defaultValue={p.copro_lots ?? ""} />
              </Field>
              <Field label="Charges annuelles moyennes (€)" htmlFor="coproAnnualCharges">
                <Input id="coproAnnualCharges" name="coproAnnualCharges" type="number" inputMode="numeric" min={0} defaultValue={p.copro_annual_charges ?? ""} />
              </Field>
            </div>
            <Field label="Procédure en cours" htmlFor="coproProcedure" hint="Facultatif : seulement s'il existe une procédure (ex. syndicat en difficulté).">
              <Input id="coproProcedure" name="coproProcedure" maxLength={500} defaultValue={p.copro_procedure ?? ""} />
            </Field>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Honoraires</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="À la charge de" htmlFor="feesPayer">
                <Select id="feesPayer" name="feesPayer" defaultValue={p.fees_payer ?? ""}>
                  <option value="">Non renseigné</option>
                  <option value="vendeur">Vendeur</option>
                  <option value="acquereur">Acquéreur</option>
                </Select>
              </Field>
              <Field label="Honoraires TTC (% du prix hors honoraires)" htmlFor="feesPercent" hint="Si à la charge de l'acquéreur. Le prix affiché est alors « honoraires inclus ».">
                <Input id="feesPercent" name="feesPercent" inputMode="decimal" defaultValue={p.fees_percent ?? ""} />
              </Field>
            </div>
          </fieldset>

          <SubmitButton pending={pending}>Enregistrer et contrôler</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
