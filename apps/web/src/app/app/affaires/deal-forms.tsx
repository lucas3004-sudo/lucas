"use client";
import { createDealAction, updateDealAction } from "@/lib/deals/actions";
import type { CrmState } from "@/lib/crm/actions";
import type { Deal } from "@/lib/deals/data";
import { ActionForm, SubmitButton } from "@/ui/client";
import { Field, Input, Select, Textarea } from "@/ui/form";
import { Alert } from "@/ui/surface";
import type { Member } from "../_crm/parts";

type Option = { id: string; label: string };
const INITIAL: CrmState = {};

function Feedback({ state }: { state: CrmState }) {
  if (state.error) return <Alert tone="danger">{state.error}</Alert>;
  if (state.success) return <Alert tone="success">{state.success}</Alert>;
  return null;
}

export function NewDealForm({
  properties,
  contacts,
  members,
  meId,
  canAssign,
  defaultPropertyId,
}: {
  properties: Option[];
  contacts: Option[];
  members: Member[];
  meId: string;
  canAssign: boolean;
  defaultPropertyId: string;
}) {
  return (
    <ActionForm action={createDealAction} initial={INITIAL} className="space-y-4 px-5 py-5">
      {(state, pending) => (
        <>
          <Feedback state={state} />
          <Field label="Bien" htmlFor="propertyId">
            <Select id="propertyId" name="propertyId" required defaultValue={defaultPropertyId}>
              <option value="" disabled>Choisir un bien</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Acquéreur" htmlFor="buyerContactId" hint="Facultatif">
              <Select id="buyerContactId" name="buyerContactId" defaultValue="">
                <option value="">Non renseigné</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Vendeur" htmlFor="sellerContactId" hint="Facultatif">
              <Select id="sellerContactId" name="sellerContactId" defaultValue="">
                <option value="">Non renseigné</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Prix convenu (€)" htmlFor="price" hint="Facultatif">
              <Input id="price" name="price" type="number" inputMode="numeric" min={1} step={1} />
            </Field>
            <Field label="Honoraires (€)" htmlFor="fees" hint="Facultatif">
              <Input id="fees" name="fees" type="number" inputMode="numeric" min={0} step={1} />
            </Field>
            <Field label="Offre acceptée le" htmlFor="offerAcceptedOn">
              <Input id="offerAcceptedOn" name="offerAcceptedOn" type="date" />
            </Field>
            {canAssign ? (
              <Field label="Négociateur en charge" htmlFor="ownerUserId">
                <Select id="ownerUserId" name="ownerUserId" defaultValue={meId}>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.name}</option>
                  ))}
                </Select>
              </Field>
            ) : (
              <input type="hidden" name="ownerUserId" value={meId} />
            )}
          </div>
          <p className="text-xs text-ink-muted">Le bien passe « sous offre » si vous avez le droit de le modifier.</p>
          <SubmitButton pending={pending}>Ouvrir l&apos;affaire</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function DealDatesForm({ deal, editable }: { deal: Deal; editable: boolean }) {
  const date = (name: string, label: string, value: string | null, hint?: string) => (
    <Field label={label} htmlFor={name} hint={hint}>
      <Input id={name} name={name} type="date" defaultValue={value ?? ""} disabled={!editable} />
    </Field>
  );
  return (
    <ActionForm action={updateDealAction} initial={INITIAL} className="space-y-4 px-5 py-4">
      {(state, pending) => (
        <>
          <Feedback state={state} />
          <input type="hidden" name="id" value={deal.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prix convenu (€)" htmlFor="price">
              <Input id="price" name="price" type="number" inputMode="numeric" min={1} step={1} defaultValue={deal.price ?? ""} disabled={!editable} />
            </Field>
            <Field label="Honoraires (€)" htmlFor="fees">
              <Input id="fees" name="fees" type="number" inputMode="numeric" min={0} step={1} defaultValue={deal.fees ?? ""} disabled={!editable} />
            </Field>
            {date("offerAcceptedOn", "Offre acceptée le", deal.offer_accepted_on)}
            {date("compromisSignedOn", "Compromis signé le", deal.compromis_signed_on)}
            {date("retractionNotifiedOn", "Notification à l'acquéreur le", deal.retraction_notified_on, "Première présentation de la lettre ou remise en main propre : point de départ du délai de rétractation.")}
            {date("loanDeadline", "Date limite d'obtention du prêt", deal.loan_deadline)}
            {date("deedPlannedOn", "Signature de l'acte prévue le", deal.deed_planned_on)}
            {date("deedSignedOn", "Acte signé le", deal.deed_signed_on)}
          </div>
          <Field label="Notaire(s)" htmlFor="notary">
            <Input id="notary" name="notary" maxLength={200} defaultValue={deal.notary ?? ""} disabled={!editable} />
          </Field>
          <Field label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" maxLength={5000} rows={3} defaultValue={deal.notes ?? ""} disabled={!editable} />
          </Field>
          {editable ? (
            <SubmitButton pending={pending} variant="secondary">
              Enregistrer
            </SubmitButton>
          ) : null}
        </>
      )}
    </ActionForm>
  );
}
