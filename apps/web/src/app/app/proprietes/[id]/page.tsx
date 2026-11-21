import { CRITERION_LABELS, matchProperty, type CriterionKey } from "@immopilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAgency } from "@/lib/agency/context";
import { deletePropertyAction, notifyColleagueAction, setPropertyStatusAction } from "@/lib/crm/actions";
import { activeProfiles, agencyMembers, asMatchProfile, asMatchProperty, getProperty, listTasks } from "@/lib/crm/data";
import { MATCHABLE_STATUSES, PROPERTY_STATUS } from "@/lib/crm/labels";
import { parseWeights, WEIGHT_KEYS } from "@/lib/crm/weights";
import { fmt } from "@/lib/format";
import { buttonClass, LinkButton } from "@/ui/button";
import { ConfirmSubmit, SubmitButton } from "@/ui/client";
import { Input, Select } from "@/ui/form";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/ui/surface";
import {
  canDeleteRecord,
  canEditRecord,
  EmptyState,
  FeatureList,
  MatchExplanation,
  memberName,
  PropertyStatusBadge,
  scoreTone,
  VisibilityBadge,
} from "../../_crm/parts";
import { TaskList } from "../../taches/task-list";
import { AppointmentList } from "../../agenda/appointment-list";
import { listAppointments } from "@/lib/agenda/data";

export const metadata: Metadata = { title: "Bien de l'agence", robots: { index: false } };

type Search = Partial<Record<string, string | string[]>>;

export default async function PropertyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const ctx = await requireAgency();
  const property = await getProperty(ctx, id.data);
  if (!property) notFound();

  const { weights, custom } = parseWeights(await searchParams);
  const matchable = MATCHABLE_STATUSES.includes(property.status);
  const [members, profiles, tasks, appointments] = await Promise.all([
    agencyMembers(ctx.org.id),
    matchable ? activeProfiles(ctx) : Promise.resolve([]),
    listTasks(ctx, "team", { propertyId: property.id }),
    listAppointments(ctx, { propertyId: property.id, from: new Date(Date.now() - 86_400_000) }),
  ]);
  const memberIds = new Set(members.map((m) => m.userId));
  const canEdit = canEditRecord(ctx, property.owner_user_id);

  // Matching sur TOUS les profils actifs de l'agence ; l'identité n'est affichée que si le contact est visible.
  const results = profiles.map((profile) => ({ profile, result: matchProperty(asMatchProperty(property), asMatchProfile(profile), weights) }));
  const matches = results
    .filter((r): r is typeof r & { result: { compatible: true } } => r.result.compatible)
    .sort((a, b) => b.result.score - a.result.score)
    .slice(0, 50);
  const excluded = results.length - results.filter((r) => r.result.compatible).length;
  const notified = new Set(
    tasks.filter((t) => t.created_by === ctx.user.id && t.status === "a_faire" && t.title.startsWith("Bien correspondant")).map((t) => t.assignee_user_id),
  );

  const dossierLink = `/app/biens/nouveau?${new URLSearchParams({
    label: property.address_label,
    banId: property.ban_id,
    type: property.type,
    ...(property.surface !== null ? { surface: String(property.surface) } : {}),
    ...(property.rooms !== null ? { rooms: String(property.rooms) } : {}),
  })}`;

  const simulationLink = `/app/investissement?${new URLSearchParams({
    bien: property.address_label,
    ...(property.price !== null ? { price: String(property.price) } : {}),
  })}`;

  return (
    <>
      <PageHeader
        title={property.address_label}
        description={<>Responsable : {memberName(members, property.owner_user_id)} · ajouté le {fmt.date(property.created_at)}</>}
        actions={
          <>
            {ctx.role !== "lecture" ? (
              <LinkButton href={`/app/agenda?bien=${property.id}&type=visite`} variant="secondary">
                Planifier une visite
              </LinkButton>
            ) : null}
            <LinkButton href={simulationLink} variant="secondary">
              Simuler un investissement
            </LinkButton>
            {ctx.role !== "lecture" ? (
              <LinkButton href={dossierLink} variant="secondary">
                Créer un dossier de bien
              </LinkButton>
            ) : null}
            {canDeleteRecord(ctx) ? (
              <form action={deletePropertyAction}>
                <input type="hidden" name="id" value={property.id} />
                <ConfirmSubmit message="Supprimer définitivement ce bien ?" size="md">
                  Supprimer
                </ConfirmSubmit>
              </form>
            ) : null}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <PropertyStatusBadge status={property.status} />
        <VisibilityBadge visibility={property.visibility} />
        {property.mandate_type ? <Badge>Mandat {property.mandate_type}</Badge> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader
            title="Acquéreurs correspondants"
            description="Profils de recherche actifs de toute l'agence. Un acquéreur privé d'un collègue reste anonyme : vous pouvez prévenir son responsable."
          />
          {!matchable ? (
            <EmptyState title={`Bien « ${PROPERTY_STATUS[property.status].toLowerCase()} » : il n'est plus rapproché des acquéreurs.`} />
          ) : (
            <>
              <details className="border-b border-line" open={custom}>
                <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-brand-text">
                  Pondérations{custom ? " (personnalisées)" : ""}
                </summary>
                <form className="flex flex-wrap items-end gap-3 px-5 pb-4">
                  {WEIGHT_KEYS.map((k: CriterionKey) => (
                    <label key={k} className="space-y-1 text-[13px] text-ink">
                      <span className="block font-medium">{CRITERION_LABELS[k]}</span>
                      <Input name={`p_${k}`} type="number" min={0} max={100} defaultValue={weights[k]} className="h-8 w-20" />
                    </label>
                  ))}
                  <button type="submit" className={buttonClass("secondary", "sm")}>
                    Recalculer
                  </button>
                  {custom ? (
                    <Link href={`/app/proprietes/${property.id}`} className={buttonClass("ghost", "sm")}>
                      Valeurs par défaut
                    </Link>
                  ) : null}
                </form>
              </details>
              {matches.length === 0 ? (
                <EmptyState title="Aucun profil de recherche compatible.">
                  {excluded ? `${excluded} profil(s) recherchent un autre type de bien.` : "L'agence n'a pas encore de profil de recherche actif."}
                </EmptyState>
              ) : (
                <ul className="divide-y divide-line">
                  {matches.map(({ profile, result }) => {
                    const owner = memberName(members, profile.owner_user_id);
                    const mine = profile.owner_user_id === ctx.user.id;
                    return (
                      <li key={profile.id} className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge tone={scoreTone(result.score)}>{result.score} %</Badge>
                          <div className="min-w-0 flex-1">
                            {profile.contact_name ? (
                              <Link href={`/app/contacts/${profile.contact_id}`} className="text-sm font-medium text-ink hover:underline">
                                {profile.contact_name}
                              </Link>
                            ) : (
                              <span className="text-sm font-medium text-ink">Acquéreur de {owner} (privé)</span>
                            )}
                            <p className="text-xs text-ink-muted">
                              {mine ? "Votre acquéreur" : `Suivi par ${owner}`}
                              {result.toVerify.length ? ` · à vérifier : ${result.toVerify.map((k) => CRITERION_LABELS[k].toLowerCase()).join(", ")}` : ""}
                            </p>
                          </div>
                          {!mine && ctx.role !== "lecture" && memberIds.has(profile.owner_user_id) ? (
                            notified.has(profile.owner_user_id) ? (
                              <Badge tone="success">{owner} prévenu(e)</Badge>
                            ) : (
                              <form action={notifyColleagueAction}>
                                <input type="hidden" name="profileId" value={profile.id} />
                                <input type="hidden" name="propertyId" value={property.id} />
                                <input type="hidden" name="score" value={result.score} />
                                <SubmitButton variant="secondary" size="sm">
                                  Prévenir {owner}
                                </SubmitButton>
                              </form>
                            )
                          ) : null}
                        </div>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-ink-muted">Pourquoi ce score ?</summary>
                          <MatchExplanation result={result} />
                        </details>
                      </li>
                    );
                  })}
                </ul>
              )}
              {matches.length > 0 && excluded > 0 ? (
                <p className="border-t border-line px-5 py-2.5 text-xs text-ink-muted">{excluded} autre(s) profil(s) recherchent un autre type de bien.</p>
              ) : null}
            </>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Caractéristiques" description="Déclarées, non vérifiées." />
            <CardBody className="space-y-1.5 text-sm">
              <p>
                <span className="text-ink-muted">Type : </span>
                {property.type}
              </p>
              <p>
                <span className="text-ink-muted">Surface : </span>
                {property.surface !== null ? `${fmt.number(property.surface)} m²` : "—"}
              </p>
              <p>
                <span className="text-ink-muted">Pièces : </span>
                {property.rooms ?? "—"}
              </p>
              <p>
                <span className="text-ink-muted">Prix : </span>
                {property.price !== null ? fmt.euros(property.price) : "—"}
                {property.price !== null && property.surface ? (
                  <span className="text-ink-muted"> ({fmt.perSqm(property.price / property.surface)})</span>
                ) : null}
              </p>
              <p>
                <span className="text-ink-muted">DPE : </span>
                {property.dpe_class ?? "—"}
              </p>
              <p>
                <span className="text-ink-muted">Équipements : </span>
                <FeatureList features={property.features} />
              </p>
              {property.notes ? <p className="whitespace-pre-line pt-2 text-ink">{property.notes}</p> : null}
            </CardBody>
            {canEdit ? (
              <form action={setPropertyStatusAction} className="flex gap-2 border-t border-line px-5 py-3">
                <input type="hidden" name="id" value={property.id} />
                <Select name="status" defaultValue={property.status} aria-label="Statut du bien" className="h-8 text-[13px]">
                  {Object.entries(PROPERTY_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
                <SubmitButton variant="secondary" size="sm">
                  Changer le statut
                </SubmitButton>
              </form>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Rendez-vous à venir" />
            {appointments.length ? (
              <AppointmentList
                appointments={appointments}
                members={members}
                meId={ctx.user.id}
                canManage={(a) => a.organizer_user_id === ctx.user.id || a.created_by === ctx.user.id || ["gerant", "manager", "assistant"].includes(ctx.role)}
              />
            ) : (
              <EmptyState title="Aucun rendez-vous prévu pour ce bien." />
            )}
          </Card>

          <Card>
            <CardHeader title="Tâches liées" />
            {tasks.length ? <TaskList tasks={tasks} members={members} meId={ctx.user.id} /> : <EmptyState title="Aucune tâche liée à ce bien." />}
          </Card>
        </div>
      </div>
    </>
  );
}
