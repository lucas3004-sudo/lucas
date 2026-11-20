"use client";
/** Formulaires du CRM. Le serveur revalide tout ; la base applique les droits (RLS). */
import Link from "next/link";
import {
  addConsentAction,
  createContactAction,
  createProfileAction,
  createPropertyAction,
  createTaskAction,
  updateContactAction,
  type CrmState,
} from "@/lib/crm/actions";
import type { Contact } from "@/lib/crm/data";
import { CONSENT_CHANNELS, CONTACT_ROLES, PROPERTY_STATUS, VISIBILITY } from "@/lib/crm/labels";
import { AddressField } from "@/ui/address-field";
import { ActionForm, SubmitButton } from "@/ui/client";
import { Check, Field, Input, Select, Textarea } from "@/ui/form";
import { Alert } from "@/ui/surface";
import { FeatureChecks, type Member } from "./parts";

const INITIAL: CrmState = {};
const today = () => new Date().toISOString().slice(0, 10);

function Feedback({ state }: { state: CrmState }) {
  if (state.error) return <Alert tone="danger">{state.error}</Alert>;
  if (state.success) return <Alert tone="success">{state.success}</Alert>;
  return null;
}

function OwnerField({ members, canAssign, meId, defaultValue }: { members: Member[]; canAssign: boolean; meId: string; defaultValue?: string }) {
  if (!canAssign) return <input type="hidden" name="ownerUserId" value={defaultValue ?? meId} />;
  return (
    <Field label="Responsable" htmlFor="ownerUserId">
      <Select id="ownerUserId" name="ownerUserId" defaultValue={defaultValue ?? meId}>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function VisibilityField({ defaultValue, hint }: { defaultValue: "private" | "agency"; hint: string }) {
  return (
    <Field label="Visibilité" htmlFor="visibility" hint={hint}>
      <Select id="visibility" name="visibility" defaultValue={defaultValue}>
        <option value="agency">{VISIBILITY.agency}</option>
        <option value="private">{VISIBILITY.private}</option>
      </Select>
    </Field>
  );
}

export function ContactForm({
  contact,
  members,
  canAssign,
  meId,
  defaultVisibility,
}: {
  contact?: Contact;
  members: Member[];
  canAssign: boolean;
  meId: string;
  defaultVisibility: "private" | "agency";
}) {
  return (
    <ActionForm action={contact ? updateContactAction : createContactAction} initial={INITIAL} className="space-y-5 px-5 py-5">
      {(state, pending) => (
        <>
          <Feedback state={state} />
          {state.duplicates?.length ? (
            <div className="space-y-2 rounded-[var(--radius-control)] border border-line bg-surface-muted px-3.5 py-3 text-sm">
              <p className="font-medium text-ink">Contacts proches déjà enregistrés :</p>
              <ul className="list-disc space-y-1 pl-5">
                {state.duplicates.map((d) => (
                  <li key={d.id}>
                    <Link href={`/app/contacts/${d.id}`} className="font-medium text-brand-text underline" target="_blank">
                      {d.label}
                    </Link>{" "}
                    <span className="text-ink-muted">({d.reasons.join(", ")} identique)</span>
                  </li>
                ))}
              </ul>
              <Check name="confirmDuplicate" value="1" label="C'est bien une autre personne : créer quand même" />
            </div>
          ) : null}
          {contact ? <input type="hidden" name="id" value={contact.id} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" htmlFor="firstName">
              <Input id="firstName" name="firstName" maxLength={80} autoComplete="off" defaultValue={contact?.first_name ?? ""} />
            </Field>
            <Field label="Nom" htmlFor="lastName">
              <Input id="lastName" name="lastName" maxLength={120} required autoComplete="off" defaultValue={contact?.last_name ?? ""} />
            </Field>
            <Field label="E-mail" htmlFor="email">
              <Input id="email" name="email" type="email" maxLength={200} autoComplete="off" defaultValue={contact?.email ?? ""} />
            </Field>
            <Field label="Téléphone" htmlFor="phone">
              <Input id="phone" name="phone" type="tel" maxLength={40} autoComplete="off" defaultValue={contact?.phone ?? ""} />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink">Rôles</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {Object.entries(CONTACT_ROLES).map(([key, label]) => (
                <Check key={key} name="roles" value={key} label={label} defaultChecked={contact?.roles.includes(key as never) ?? false} />
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <VisibilityField
              defaultValue={contact?.visibility ?? defaultVisibility}
              hint="Privé : visible seulement par le responsable, le gérant et les managers."
            />
            <OwnerField members={members} canAssign={canAssign} meId={meId} defaultValue={contact?.owner_user_id} />
            <Field label="Origine" htmlFor="source" hint="Facultatif. Ex. : vitrine, recommandation, salon.">
              <Input id="source" name="source" maxLength={120} defaultValue={contact?.source ?? ""} />
            </Field>
          </div>

          <Field label="Notes" htmlFor="notes" hint="Faits utiles au projet immobilier uniquement. Pas de données sensibles (santé, opinions…).">
            <Textarea id="notes" name="notes" maxLength={5000} rows={3} defaultValue={contact?.notes ?? ""} />
          </Field>

          <SubmitButton pending={pending} pendingLabel="Enregistrement…">
            {contact ? "Enregistrer les modifications" : "Créer le contact"}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ConsentForm({ contactId }: { contactId: string }) {
  return (
    <ActionForm action={addConsentAction} initial={INITIAL} resetOnSuccess className="space-y-4 px-5 py-4">
      {(state, pending) => (
        <>
          <Feedback state={state} />
          <input type="hidden" name="contactId" value={contactId} />
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Canal" htmlFor="channel">
              <Select id="channel" name="channel">
                {Object.entries(CONSENT_CHANNELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Décision" htmlFor="status">
              <Select id="status" name="status">
                <option value="accorde">Accordé</option>
                <option value="retire">Retiré</option>
              </Select>
            </Field>
            <Field label="Recueilli le" htmlFor="obtainedAt">
              <Input id="obtainedAt" name="obtainedAt" type="date" required defaultValue={today()} max={today()} />
            </Field>
            <Field label="Expire le" htmlFor="expiresAt" hint="Facultatif">
              <Input id="expiresAt" name="expiresAt" type="date" />
            </Field>
          </div>
          <Field label="Preuve" htmlFor="proof" hint="Où, quand et comment : ex. « accord oral à l'agence le 12/03, en présence de… », « case cochée sur le formulaire papier ».">
            <Textarea id="proof" name="proof" required minLength={3} maxLength={1000} rows={2} />
          </Field>
          <SubmitButton pending={pending} variant="secondary" size="sm">
            Enregistrer
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ProfileForm({ contactId }: { contactId: string }) {
  return (
    <ActionForm action={createProfileAction} initial={INITIAL} resetOnSuccess className="space-y-4 px-5 py-4">
      {(state, pending) => (
        <>
          <Feedback state={state} />
          <input type="hidden" name="contactId" value={contactId} />
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink">Type de bien recherché</legend>
            <div className="flex gap-5">
              <Check name="types" value="Appartement" label="Appartement" defaultChecked />
              <Check name="types" value="Maison" label="Maison" />
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Budget maximal (€)" htmlFor="budgetMax" hint="Facultatif">
              <Input id="budgetMax" name="budgetMax" type="number" inputMode="numeric" min={1000} step={1000} />
            </Field>
            <Field label="Surface minimale (m²)" htmlFor="surfaceMin" hint="Facultatif">
              <Input id="surfaceMin" name="surfaceMin" type="number" inputMode="decimal" min={9} max={2000} />
            </Field>
            <Field label="Pièces minimum" htmlFor="roomsMin" hint="Facultatif">
              <Input id="roomsMin" name="roomsMin" type="number" inputMode="numeric" min={1} max={30} />
            </Field>
          </div>
          <Field label="Codes postaux recherchés" htmlFor="postcodes" hint="Séparés par des espaces ou des virgules. Vide : pas de secteur imposé.">
            <Input id="postcodes" name="postcodes" maxLength={200} placeholder="Ex. : 80000 80090" />
          </Field>
          <FeatureChecks />
          <p className="text-xs text-ink-muted">
            Uniquement des critères sur le bien : aucun critère lié aux personnes n&apos;est possible (non-discrimination).
          </p>
          <SubmitButton pending={pending} variant="secondary" size="sm" pendingLabel="Recherche des communes…">
            Ajouter le profil
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function PropertyForm({
  members,
  canAssign,
  meId,
  defaultVisibility,
}: {
  members: Member[];
  canAssign: boolean;
  meId: string;
  defaultVisibility: "private" | "agency";
}) {
  return (
    <ActionForm action={createPropertyAction} initial={INITIAL} className="space-y-5 px-5 py-5">
      {(state, pending) => (
        <>
          <Feedback state={state} />
          <AddressField />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type de bien" htmlFor="type">
              <Select id="type" name="type">
                <option value="Appartement">Appartement</option>
                <option value="Maison">Maison</option>
              </Select>
            </Field>
            <Field label="Surface habitable (m²)" htmlFor="surface">
              <Input id="surface" name="surface" type="number" inputMode="decimal" min={9} max={2000} step="0.1" />
            </Field>
            <Field label="Pièces principales" htmlFor="rooms">
              <Input id="rooms" name="rooms" type="number" inputMode="numeric" min={1} max={30} />
            </Field>
            <Field label="Prix affiché (€)" htmlFor="price">
              <Input id="price" name="price" type="number" inputMode="numeric" min={1000} step={1000} />
            </Field>
            <Field label="Classe DPE" htmlFor="dpeClass" hint="Telle que déclarée">
              <Select id="dpeClass" name="dpeClass" defaultValue="">
                <option value="">Non renseignée</option>
                {["A", "B", "C", "D", "E", "F", "G"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Statut" htmlFor="status">
              <Select id="status" name="status" defaultValue="mandat">
                {Object.entries(PROPERTY_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Mandat" htmlFor="mandateType">
              <Select id="mandateType" name="mandateType" defaultValue="">
                <option value="">Non précisé</option>
                <option value="simple">Simple</option>
                <option value="exclusif">Exclusif</option>
              </Select>
            </Field>
            <VisibilityField defaultValue={defaultVisibility} hint="Privé : visible seulement par le responsable, le gérant et les managers." />
            <OwnerField members={members} canAssign={canAssign} meId={meId} />
          </div>
          <FeatureChecks />
          <Field label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" maxLength={5000} rows={3} />
          </Field>
          <p className="text-xs text-ink-muted">Ces caractéristiques sont déclarées : elles ne sont pas vérifiées.</p>
          <SubmitButton pending={pending} pendingLabel="Vérification de l'adresse…">
            Créer le bien
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function TaskForm({ members, meId, contactId }: { members: Member[]; meId: string; contactId?: string }) {
  return (
    <ActionForm action={createTaskAction} initial={INITIAL} resetOnSuccess className="space-y-4 px-5 py-4">
      {(state, pending) => (
        <>
          <Feedback state={state} />
          {contactId ? <input type="hidden" name="contactId" value={contactId} /> : null}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="Tâche" htmlFor="title">
              <Input id="title" name="title" required minLength={2} maxLength={200} placeholder="Ex. : rappeler pour la visite" />
            </Field>
            <Field label="Pour" htmlFor="assigneeUserId">
              <Select id="assigneeUserId" name="assigneeUserId" defaultValue={meId}>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.userId === meId ? `${m.name} (moi)` : m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Échéance" htmlFor="dueOn" hint="Facultatif">
              <Input id="dueOn" name="dueOn" type="date" />
            </Field>
          </div>
          <Field label="Détails" htmlFor="details" hint="Facultatif">
            <Textarea id="details" name="details" maxLength={2000} rows={2} />
          </Field>
          <SubmitButton pending={pending} variant="secondary" size="sm">
            Ajouter la tâche
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
