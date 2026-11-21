"use client";
import { createAppointmentAction } from "@/lib/agenda/actions";
import { APPOINTMENT_KINDS, DURATIONS_MIN } from "@/lib/agenda/labels";
import type { CrmState } from "@/lib/crm/actions";
import { ActionForm, SubmitButton } from "@/ui/client";
import { Field, Input, Select, Textarea } from "@/ui/form";
import { Alert } from "@/ui/surface";
import type { Member } from "../_crm/parts";

type Option = { id: string; label: string };

export function AppointmentForm({
  members,
  meId,
  canAssign,
  contacts,
  properties,
  defaults,
}: {
  members: Member[];
  meId: string;
  canAssign: boolean;
  contacts: Option[];
  properties: Option[];
  defaults: { kind: string; contactId: string; propertyId: string; start: string };
}) {
  return (
    <ActionForm action={createAppointmentAction} initial={{} as CrmState} resetOnSuccess className="space-y-4 px-5 py-4">
      {(state, pending) => (
        <>
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
          {state.success ? <Alert tone="success">{state.success}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Field label="Type" htmlFor="kind">
              <Select id="kind" name="kind" defaultValue={defaults.kind}>
                {Object.entries(APPOINTMENT_KINDS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
            <Field label="Objet" htmlFor="title">
              <Input id="title" name="title" required minLength={2} maxLength={200} placeholder="Ex. : visite avec M. et Mme Martin" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Début (heure de Paris)" htmlFor="start">
              <Input id="start" name="start" type="datetime-local" required defaultValue={defaults.start} />
            </Field>
            <Field label="Durée" htmlFor="duration">
              <Select id="duration" name="duration" defaultValue="60">
                {DURATIONS_MIN.map((d) => (
                  <option key={d} value={d}>{d < 60 ? `${d} min` : `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60}` : ""}`}</option>
                ))}
              </Select>
            </Field>
            {canAssign ? (
              <Field label="Pour" htmlFor="organizerUserId">
                <Select id="organizerUserId" name="organizerUserId" defaultValue={meId}>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.userId === meId ? `${m.name} (moi)` : m.name}</option>
                  ))}
                </Select>
              </Field>
            ) : (
              <input type="hidden" name="organizerUserId" value={meId} />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact" htmlFor="contactId" hint="Facultatif">
              <Select id="contactId" name="contactId" defaultValue={defaults.contactId}>
                <option value="">Aucun</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Bien" htmlFor="propertyId" hint="Facultatif. Son adresse sert de lieu si le lieu est vide.">
              <Select id="propertyId" name="propertyId" defaultValue={defaults.propertyId}>
                <option value="">Aucun</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Lieu" htmlFor="location" hint="Facultatif">
            <Input id="location" name="location" maxLength={300} />
          </Field>
          <Field label="Notes" htmlFor="notes" hint="Facultatif">
            <Textarea id="notes" name="notes" maxLength={2000} rows={2} />
          </Field>
          <SubmitButton pending={pending}>Planifier</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
