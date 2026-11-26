import { CRITERION_LABELS, defaultFollowUpOn, INTEREST_LABELS, mandateAlert, mandateAlertLabel, matchProperty, NEXT_STEP_LABELS, ownerReach, PRICE_OPINION_LABELS, utcToParisLocal, visitStats, type CriterionKey } from "@immopilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAgency } from "@/lib/agency/context";
import { deletePropertyAction, notifyColleagueAction, setPropertyStatusAction, updatePropertyPriceAction } from "@/lib/crm/actions";
import { activeProfiles, agencyMembers, asMatchProfile, asMatchProperty, contactName, currentConsents, getContact, getProperty, listContacts, listTasks } from "@/lib/crm/data";
import { followPropertyAction, setSellerContactAction } from "@/lib/crm/prospection-actions";
import { ProspectionStatusForm } from "../../prospection/status-form";
import { MATCHABLE_STATUSES, PROPERTY_STATUS } from "@/lib/crm/labels";
import { parseWeights, WEIGHT_KEYS } from "@/lib/crm/weights";
import { fmt } from "@/lib/format";
import { buttonClass, LinkButton } from "@/ui/button";
import { ConfirmSubmit, SubmitButton } from "@/ui/client";
import { Input, Select } from "@/ui/form";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/ui/surface";
import {
  canDeleteRecord,
  canEditRecord,
  EmptyState,
  FeatureList,
  MatchExplanation,
  memberName,
  PropertyStatusBadge,
  ProspectionBadge,
  scoreTone,
  VisibilityBadge,
} from "../../_crm/parts";
import { TaskList } from "../../taches/task-list";
import { withTenant } from "@immopilot/db";
import { MAX_PHOTOS } from "@/lib/crm/photo-limits";
import { deletePhotoAction } from "@/lib/crm/photos";
import { getTenantPool } from "@/lib/server/db";
import { MandateForm } from "./mandate-form";
import { PhotoUpload } from "./photo-upload";
import { AppointmentList } from "../../agenda/appointment-list";
import { listAppointments } from "@/lib/agenda/data";
import { listDeals } from "@/lib/deals/data";
import { DEAL_STAGES } from "@/lib/deals/labels";
import { reportsForProperty } from "@/lib/visits/data";

export const metadata: Metadata = { title: "Bien de l'agence", robots: { index: false } };

type Search = Partial<Record<string, string | string[]>>;

export default async function PropertyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const ctx = await requireAgency();
  const property = await getProperty(ctx, id.data);
  if (!property) notFound();

  const sp = await searchParams;
  const { weights, custom } = parseWeights(sp);
  const matchable = MATCHABLE_STATUSES.includes(property.status);
  const [members, profiles, tasks, appointments, deals, photos, visits] = await Promise.all([
    agencyMembers(ctx.org.id),
    matchable ? activeProfiles(ctx) : Promise.resolve([]),
    listTasks(ctx, "team", { propertyId: property.id }),
    listAppointments(ctx, { propertyId: property.id, from: new Date(Date.now() - 86_400_000) }),
    listDeals(ctx, { propertyId: property.id }),
    withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
      (await c.query<{ id: string; width: number; height: number }>(
        "SELECT id, width, height FROM app.property_photos WHERE property_id = $1 ORDER BY position, created_at", [property.id],
      )).rows),
    reportsForProperty(ctx, property.id),
  ]);
  // Prospection (D-072) : propriétaire (contact vendeur visible) et ses accords en cours.
  const prospecting = property.prospection_status !== null;
  const [seller, contacts] = prospecting
    ? await Promise.all([property.seller_contact_id ? getContact(ctx, property.seller_contact_id) : Promise.resolve(null), listContacts(ctx)])
    : [null, []];
  const sellerConsents = seller ? currentConsents(seller.consents, utcToParisLocal(new Date()).slice(0, 10)) : {};
  const reach = ownerReach({
    hasOwner: seller !== null, phone: seller?.contact.phone ?? null, email: seller?.contact.email ?? null,
    phoneConsent: sellerConsents.telephone?.valid ?? false, emailConsent: sellerConsents.email?.valid ?? false,
  });
  const sellerOptions = contacts.filter((c) => c.roles.includes("vendeur") || c.id === property.seller_contact_id);
  const today = utcToParisLocal(new Date()).slice(0, 10);
  const vstats = visitStats(visits.map((v) => ({ interest: v.interest, priceOpinion: v.price_opinion, nextStep: v.next_step })));
  const memberIds = new Set(members.map((m) => m.userId));
  const canEdit = canEditRecord(ctx, property.owner_user_id);
  const mandate = mandateAlert({ status: property.status, mandateEndsOn: property.mandate_ends_on }, utcToParisLocal(new Date()).slice(0, 10));

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
            <LinkButton href={`/app/proprietes/${property.id}/fiche`}>Voir la fiche</LinkButton>
            {ctx.role !== "lecture" && property.status !== "vendu" && property.status !== "retire" ? (
              <LinkButton href={`/app/affaires/nouvelle?bien=${property.id}`} variant="secondary">
                Ouvrir une affaire
              </LinkButton>
            ) : null}
            {ctx.role !== "lecture" ? (
              <LinkButton href={`/app/agenda?bien=${property.id}&type=visite`} variant="secondary">
                Planifier une visite
              </LinkButton>
            ) : null}
            <LinkButton href={`/app/proprietes/${property.id}/annonce`} variant="secondary">
              Annonce
            </LinkButton>
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
        {mandate ? <Badge tone={mandate.kind === "expire" ? "danger" : "warning"}>{mandateAlertLabel(mandate)}</Badge> : null}
        {property.prospection_status ? <ProspectionBadge status={property.prospection_status} /> : null}
      </div>

      {property.prospection_status ? (
        <Card className="mb-4">
          <CardHeader
            title="Prospection"
            description="Bien que l'agence aimerait rentrer en mandat. Les relances sont des tâches ; les accords du propriétaire se notent sur sa fiche contact."
            action={<Link href="/app/prospection" className="text-sm font-medium text-brand-text hover:underline">Toute la prospection</Link>}
          />
          <div className="space-y-4 px-5 py-4">
            {sp.repere === "1" ? <Alert tone="success">Bien ajouté à votre prospection, « à contacter ».</Alert> : null}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <ProspectionBadge status={property.prospection_status} />
              {property.prospection_favorite ? <Badge tone="warning">★ Favori</Badge> : null}
              {property.source_url ? (
                <a href={property.source_url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-brand-text hover:underline">
                  Voir l&apos;annonce d&apos;origine ↗
                </a>
              ) : null}
            </div>
            {canEdit && ctx.role !== "lecture" ? (
              <ProspectionStatusForm
                id={property.id}
                status={property.prospection_status}
                today={today}
                defaultFollowUpOn={defaultFollowUpOn(today)}
                label={property.address_label}
              />
            ) : null}
            <div className="space-y-2 border-t border-line pt-4">
              <p className="text-sm text-ink">
                {seller ? (
                  <>
                    Propriétaire :{" "}
                    <Link href={`/app/contacts/${seller.contact.id}`} className="font-medium hover:underline">
                      {contactName(seller.contact)}
                    </Link>
                  </>
                ) : property.seller_contact_id ? (
                  "Propriétaire : contact privé d'un collègue."
                ) : (
                  "Propriétaire non renseigné."
                )}
              </p>
              {property.seller_contact_id && !seller ? null : <p className="text-xs text-ink-muted">{reach.message}</p>}
              {reach.call || reach.email ? (
                <div className="flex flex-wrap gap-2">
                  {reach.call && seller?.contact.phone ? (
                    <a href={`tel:${seller.contact.phone.replace(/[^\d+]/g, "")}`} className={buttonClass("secondary", "sm")}>Appeler</a>
                  ) : null}
                  {reach.email && seller?.contact.email ? (
                    <a href={`mailto:${seller.contact.email}`} className={buttonClass("secondary", "sm")}>Écrire un e-mail</a>
                  ) : null}
                </div>
              ) : null}
              {canEdit && ctx.role !== "lecture" && (seller || !property.seller_contact_id) ? (
                <form action={setSellerContactAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={property.id} />
                  <label className="space-y-1 text-[13px] text-ink">
                    <span className="block font-medium">Propriétaire (contact vendeur)</span>
                    <Select name="sellerContactId" defaultValue={property.seller_contact_id ?? ""} className="h-9 w-auto">
                      <option value="">Non renseigné</option>
                      {sellerOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {contactName(c)}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <SubmitButton size="sm" variant="secondary">Enregistrer le propriétaire</SubmitButton>
                  <Link href="/app/contacts/nouveau" className={buttonClass("ghost", "sm")}>Créer le contact du propriétaire</Link>
                </form>
              ) : null}
            </div>
          </div>
        </Card>
      ) : property.status === "prospect" && canEdit && ctx.role !== "lecture" ? (
        <form action={followPropertyAction} className="mb-4">
          <input type="hidden" name="id" value={property.id} />
          <SubmitButton size="sm" variant="secondary">Suivre en prospection</SubmitButton>
        </form>
      ) : null}

      <Card className="mb-4">
        <CardHeader title={`Photos (${photos.length})`} />
        {photos.length ? (
          <ul className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-4 lg:grid-cols-6">
            {photos.map((ph, i) => (
              <li key={ph.id} className="space-y-1.5">
                <a href={`/api/v1/photos/${ph.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[var(--radius-control)] border border-line bg-surface-muted">
                  <img src={`/api/v1/photos/${ph.id}`} alt={`Photo ${i + 1} du bien`} width={ph.width} height={ph.height} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                </a>
                {canEdit ? (
                  <form action={deletePhotoAction}>
                    <input type="hidden" name="id" value={ph.id} />
                    <input type="hidden" name="propertyId" value={property.id} />
                    <ConfirmSubmit message="Supprimer cette photo ?" ariaLabel={`Supprimer la photo ${i + 1}`}>Supprimer</ConfirmSubmit>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-ink-muted">Aucune photo pour le moment.</p>
        )}
        {canEdit ? (
          <div className="border-t border-line">
            <PhotoUpload propertyId={property.id} remaining={MAX_PHOTOS - photos.length} />
          </div>
        ) : null}
      </Card>

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
                <span data-testid="prix-affiche">{property.price !== null ? fmt.euros(property.price) : "—"}</span>
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
            {canEdit ? (
              <form action={updatePropertyPriceAction} className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
                <input type="hidden" name="id" value={property.id} />
                <label htmlFor="nouveau-prix" className="text-[13px] text-ink-muted">Prix affiché (€)</label>
                <Input id="nouveau-prix" name="price" inputMode="numeric" defaultValue={property.price ?? ""} className="h-8 w-36 text-[13px]" />
                <SubmitButton variant="secondary" size="sm">
                  Modifier le prix
                </SubmitButton>
              </form>
            ) : null}
          </Card>

          <Card>
            <CardHeader
              title="Mandat"
              description="Suivi pour les rappels d'échéance. Votre registre des mandats reste la référence officielle."
            />
            <CardBody className="space-y-1.5 text-sm">
              <p><span className="text-ink-muted">Type : </span>{property.mandate_type ? (property.mandate_type === "exclusif" ? "exclusif" : "simple") : "—"}</p>
              <p><span className="text-ink-muted">Numéro : </span>{property.mandate_number ?? "—"}</p>
              <p><span className="text-ink-muted">Signé le : </span>{property.mandate_signed_on ? fmt.date(property.mandate_signed_on) : "—"}</p>
              <p><span className="text-ink-muted">Fin : </span>{property.mandate_ends_on ? fmt.date(property.mandate_ends_on) : "—"}</p>
            </CardBody>
            {canEdit ? (
              <details className="border-t border-line">
                <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-ink">Modifier le mandat</summary>
                <MandateForm
                  propertyId={property.id}
                  initial={{
                    mandateType: property.mandate_type ?? "",
                    mandateNumber: property.mandate_number ?? "",
                    signedOn: property.mandate_signed_on ?? "",
                    endsOn: property.mandate_ends_on ?? "",
                  }}
                />
              </details>
            ) : null}
          </Card>

          {deals.length ? (
            <Card>
              <CardHeader title="Affaires" />
              <ul className="divide-y divide-line">
                {deals.map((d) => (
                  <li key={d.id}>
                    <Link href={`/app/affaires/${d.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-surface-muted">
                      <Badge tone={d.stage === "acte" ? "success" : d.stage === "abandon" ? "neutral" : "brand"}>{DEAL_STAGES[d.stage]}</Badge>
                      <span className="flex-1 text-ink-muted">{d.price !== null ? fmt.euros(d.price) : "Prix non renseigné"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {visits.length ? (
            <Card>
              <CardHeader
                title={`Comptes rendus de visite (${vstats.visits})`}
                description={`${vstats.byInterest.fort} intérêt fort, ${vstats.offersConsidered} offre(s) envisagée(s)${
                  vstats.priceOpinions ? `, réserve sur le prix ${vstats.priceObjections} fois sur ${vstats.priceOpinions}` : ""
                }.`}
              />
              <ul className="divide-y divide-line">
                {visits.slice(0, 10).map((v) => (
                  <li key={v.id} className="px-5 py-2.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={v.interest === "fort" ? "success" : v.interest === "aucun" ? "neutral" : "brand"}>{INTEREST_LABELS[v.interest]}</Badge>
                      <span className="text-ink">{NEXT_STEP_LABELS[v.next_step]}</span>
                      {v.visit_at ? <span className="text-xs text-ink-muted">{fmt.date(v.visit_at)}</span> : null}
                    </div>
                    {v.price_opinion || v.objections ? (
                      <p className="mt-1 text-[13px] text-ink-muted">
                        {[v.price_opinion ? PRICE_OPINION_LABELS[v.price_opinion] : null, v.objections].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

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
