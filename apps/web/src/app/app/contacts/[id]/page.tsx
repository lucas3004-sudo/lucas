import { matchProperty, PROPERTY_FEATURES } from "@immopilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAgency } from "@/lib/agency/context";
import { getAgencySettings } from "@/lib/agency/settings";
import { deleteContactAction, setProfileStatusAction } from "@/lib/crm/actions";
import {
  agencyMembers,
  asMatchProfile,
  asMatchProperty,
  communeNames,
  contactName,
  currentConsents,
  getContact,
  listTasks,
  matchableProperties,
  type BuyerProfile,
} from "@/lib/crm/data";
import { CONSENT_CHANNELS, CONTACT_ROLES, PROFILE_STATUS, type ConsentChannel } from "@/lib/crm/labels";
import { fmt } from "@/lib/format";
import { ConfirmSubmit, SubmitButton } from "@/ui/client";
import { Select } from "@/ui/form";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/ui/surface";
import { ConsentForm, ContactForm, ProfileForm, TaskForm } from "../../_crm/forms";
import {
  canAssignOwner,
  canDeleteRecord,
  canEditRecord,
  EmptyState,
  MatchExplanation,
  memberName,
  scoreTone,
  VisibilityBadge,
} from "../../_crm/parts";
import { TaskList } from "../../taches/task-list";

export const metadata: Metadata = { title: "Contact", robots: { index: false } };

function profileSummary(p: BuyerProfile, communes: Map<string, string>): string[] {
  const parts = [p.types.join(" ou ")];
  if (p.budget_max !== null) parts.push(`jusqu'à ${fmt.euros(p.budget_max)}`);
  if (p.surface_min !== null) parts.push(`${fmt.number(p.surface_min)} m² minimum`);
  if (p.rooms_min !== null) parts.push(`${p.rooms_min} pièce(s) minimum`);
  parts.push(p.insee_codes.length ? p.insee_codes.map((c) => communes.get(c) ?? `commune ${c}`).join(", ") : "tout secteur");
  if (p.features.length) parts.push(p.features.map((f) => PROPERTY_FEATURES[f].toLowerCase()).join(", "));
  return parts;
}

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const ctx = await requireAgency();
  const data = await getContact(ctx, id.data);
  if (!data) notFound();
  const { contact, consents, profiles } = data;

  const active = profiles.filter((p) => p.status === "actif");
  const [members, settings, properties, communes, tasks] = await Promise.all([
    agencyMembers(ctx.org.id),
    getAgencySettings(ctx),
    active.length ? matchableProperties(ctx) : Promise.resolve([]),
    communeNames(ctx, [...new Set(profiles.flatMap((p) => p.insee_codes))]),
    listTasks(ctx, "team", { contactId: contact.id }),
  ]);
  const canEdit = canEditRecord(ctx, contact.owner_user_id);
  const consentNow = currentConsents(consents);

  return (
    <>
      <PageHeader
        title={contactName(contact)}
        description={
          <>
            Responsable : {memberName(members, contact.owner_user_id)} · créé le {fmt.date(contact.created_at)}
          </>
        }
        actions={
          canDeleteRecord(ctx) ? (
            <form action={deleteContactAction}>
              <input type="hidden" name="id" value={contact.id} />
              <ConfirmSubmit message="Supprimer définitivement ce contact, ses consentements et ses profils de recherche ?">Supprimer</ConfirmSubmit>
            </form>
          ) : null
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <VisibilityBadge visibility={contact.visibility} />
        {contact.roles.map((r) => (
          <Badge key={r} tone="brand">
            {CONTACT_ROLES[r]}
          </Badge>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Profils de recherche" description="Critères sur le bien uniquement. Ils servent au rapprochement avec les biens de toute l'agence." />
            {profiles.length === 0 ? (
              <EmptyState title="Aucun profil de recherche." />
            ) : (
              <ul className="divide-y divide-line">
                {profiles.map((p) => {
                  const matches =
                    p.status === "actif"
                      ? properties
                          .map((prop) => ({ prop, result: matchProperty(asMatchProperty(prop), asMatchProfile(p)) }))
                          .filter((m): m is typeof m & { result: { compatible: true } } => m.result.compatible)
                          .sort((a, b) => b.result.score - a.result.score)
                          .slice(0, 5)
                      : [];
                  return (
                    <li key={p.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="text-sm text-ink">{profileSummary(p, communes).join(" · ")}</p>
                        {canEdit ? (
                          <form action={setProfileStatusAction} className="flex gap-2">
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="contactId" value={contact.id} />
                            <Select name="status" defaultValue={p.status} aria-label="Statut du profil" className="h-8 w-32 text-[13px]">
                              {Object.entries(PROFILE_STATUS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </Select>
                            <SubmitButton variant="secondary" size="sm">
                              Changer
                            </SubmitButton>
                          </form>
                        ) : (
                          <Badge>{PROFILE_STATUS[p.status]}</Badge>
                        )}
                      </div>
                      {p.status === "actif" ? (
                        <div className="mt-3">
                          <p className="text-[13px] font-medium text-ink-muted">Biens correspondants visibles par vous</p>
                          {matches.length === 0 ? (
                            <p className="mt-1 text-[13px] text-ink-muted">Aucun bien compatible pour le moment.</p>
                          ) : (
                            <ul className="mt-2 space-y-2">
                              {matches.map(({ prop, result }) => (
                                <li key={prop.id} className="rounded-[var(--radius-control)] border border-line px-3 py-2">
                                  <details>
                                    <summary className="flex cursor-pointer list-none items-center gap-3">
                                      <Badge tone={scoreTone(result.score)}>{result.score} %</Badge>
                                      <Link href={`/app/proprietes/${prop.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:underline">
                                        {prop.address_label}
                                      </Link>
                                      <span className="text-xs text-ink-muted">Pourquoi ?</span>
                                    </summary>
                                    <MatchExplanation result={result} />
                                  </details>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {canEdit ? (
              <details className="border-t border-line">
                <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-brand-text">Ajouter un profil de recherche</summary>
                <ProfileForm contactId={contact.id} />
              </details>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Tâches liées" />
            {tasks.length ? <TaskList tasks={tasks} members={members} meId={ctx.user.id} /> : <EmptyState title="Aucune tâche liée à ce contact." />}
            {ctx.role !== "lecture" ? (
              <details className="border-t border-line">
                <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-brand-text">Ajouter une tâche</summary>
                <TaskForm members={members} meId={ctx.user.id} contactId={contact.id} />
              </details>
            ) : null}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Coordonnées" />
            <CardBody className="space-y-1.5 text-sm">
              <p>
                <span className="text-ink-muted">E-mail : </span>
                {contact.email ?? "—"}
              </p>
              <p>
                <span className="text-ink-muted">Téléphone : </span>
                {contact.phone ?? "—"}
              </p>
              {contact.source ? (
                <p>
                  <span className="text-ink-muted">Origine : </span>
                  {contact.source}
                </p>
              ) : null}
              {contact.notes ? <p className="whitespace-pre-line pt-2 text-ink">{contact.notes}</p> : null}
            </CardBody>
            {canEdit ? (
              <details className="border-t border-line">
                <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-brand-text">Modifier le contact</summary>
                <ContactForm
                  contact={contact}
                  members={members}
                  canAssign={canAssignOwner(ctx)}
                  meId={ctx.user.id}
                  defaultVisibility={settings.defaultVisibility}
                />
              </details>
            ) : null}
          </Card>

          <Card>
            <CardHeader
              title="Consentements de prospection"
              description="Avant tout démarchage par téléphone, e-mail ou SMS. Chaque décision est conservée avec sa preuve."
            />
            <CardBody className="space-y-2">
              {(Object.keys(CONSENT_CHANNELS) as ConsentChannel[]).map((ch) => {
                const now = consentNow[ch];
                return (
                  <div key={ch} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink">{CONSENT_CHANNELS[ch]}</span>
                    {!now ? (
                      <Badge>Non recueilli</Badge>
                    ) : now.valid ? (
                      <Badge tone="success">Accordé{now.consent.expires_at ? ` jusqu'au ${fmt.date(now.consent.expires_at)}` : ""}</Badge>
                    ) : (
                      <Badge tone="danger">{now.consent.status === "retire" ? "Retiré" : "Expiré"}</Badge>
                    )}
                  </div>
                );
              })}
            </CardBody>
            {consents.length ? (
              <details className="border-t border-line">
                <summary className="cursor-pointer px-5 py-3 text-sm text-ink-muted">Historique et preuves ({consents.length})</summary>
                <ul className="divide-y divide-line border-t border-line">
                  {consents.map((c) => (
                    <li key={c.id} className="px-5 py-2.5 text-[13px]">
                      <p className="text-ink">
                        {CONSENT_CHANNELS[c.channel]} : {c.status === "accorde" ? "accordé" : "retiré"} le {fmt.date(c.obtained_at)}
                        {c.expires_at ? `, expire le ${fmt.date(c.expires_at)}` : ""}
                      </p>
                      <p className="text-ink-muted">
                        {c.proof} — saisi par {memberName(members, c.recorded_by)}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {canEdit ? (
              <details className="border-t border-line">
                <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-brand-text">Enregistrer un consentement ou un retrait</summary>
                <ConsentForm contactId={contact.id} />
              </details>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  );
}
