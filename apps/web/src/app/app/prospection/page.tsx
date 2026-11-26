import {
  defaultFollowUpOn, isProspectionClosed, isProspectionStatus, ownerReach, PROSPECTION_LABELS, PROSPECTION_STATUSES, prospectionCounts,
  utcToParisLocal, type ProspectionStatus,
} from "@immopilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/agency/context";
import { agencyMembers } from "@/lib/crm/data";
import { listProspects, type Prospect } from "@/lib/crm/prospection";
import { setProspectionFavoriteAction } from "@/lib/crm/prospection-actions";
import { fmt } from "@/lib/format";
import { buttonClass, LinkButton } from "@/ui/button";
import { SubmitButton } from "@/ui/client";
import { cn } from "@/ui/cn";
import { Alert, Badge, Card, PageHeader } from "@/ui/surface";
import { canEditRecord, EmptyState, memberName, ProspectionBadge, VisibilityBadge } from "../_crm/parts";
import { ProspectionStatusForm } from "./status-form";

export const metadata: Metadata = { title: "Prospection", robots: { index: false } };

type Filter = "en_cours" | "tous" | ProspectionStatus;

export default async function ProspectionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAgency();
  const asked = (await searchParams).statut;
  const filter: Filter = asked === "tous" || isProspectionStatus(asked) ? asked : "en_cours";
  const [prospects, members] = await Promise.all([listProspects(ctx), agencyMembers(ctx.org.id)]);
  const counts = prospectionCounts(prospects.map((p) => p.status));
  const shown = prospects.filter((p) => (filter === "tous" ? true : filter === "en_cours" ? !isProspectionClosed(p.status) : p.status === filter));
  const today = utcToParisLocal(new Date()).slice(0, 10);

  const tabs: Array<{ key: Filter; label: string; n: number }> = [
    { key: "en_cours", label: "En cours", n: counts.open },
    ...PROSPECTION_STATUSES.map((s) => ({ key: s as Filter, label: PROSPECTION_LABELS[s], n: counts.byStatus[s] })),
    { key: "tous", label: "Tous", n: counts.total },
  ];

  return (
    <>
      <PageHeader
        title="Prospection"
        description="Les biens que vous aimeriez rentrer en mandat : annonces de particuliers repérées, bouche-à-oreille, demandes de votre page « Estimez votre bien ». Suivez chaque propriétaire jusqu'au mandat."
        actions={ctx.role !== "lecture" ? <LinkButton href="/app/proprietes/nouveau?prospection=1">Ajouter un bien repéré</LinkButton> : null}
      />
      <div className="mb-4">
        <Alert tone="brand">
          Appel ou e-mail de prospection : seulement avec l&apos;accord préalable du propriétaire (règle en vigueur depuis le 11 août 2026). Un numéro publié dans une annonce ne vaut pas accord. Le courrier et la visite d&apos;estimation restent possibles.
        </Alert>
      </div>
      <nav aria-label="Filtrer par statut" className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "en_cours" ? "/app/prospection" : `/app/prospection?statut=${t.key}`}
            aria-current={filter === t.key ? "page" : undefined}
            className={cn(buttonClass(filter === t.key ? "primary" : "secondary", "sm"))}
          >
            {t.label} ({t.n})
          </Link>
        ))}
      </nav>
      <Card>
        {shown.length === 0 ? (
          <EmptyState title={counts.total === 0 ? "Aucun bien en prospection pour le moment." : "Aucun bien pour ce statut."}>
            {counts.total === 0
              ? "Ajoutez un bien repéré (annonce de particulier, panneau « à vendre », bouche-à-oreille). Les demandes reçues par votre page « Estimez votre bien » arrivent aussi ici, « à contacter »."
              : "Choisissez un autre statut ci-dessus."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line" aria-label="Biens en prospection">
            {shown.map((p) => (
              <ProspectRow key={p.id} p={p} today={today} canEdit={ctx.role !== "lecture" && canEditRecord(ctx, p.ownerUserId)} owner={memberName(members, p.ownerUserId)} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function ProspectRow({ p, today, canEdit, owner }: { p: Prospect; today: string; canEdit: boolean; owner: string }) {
  const reach = ownerReach({
    hasOwner: p.seller !== null, phone: p.seller?.phone ?? null, email: p.seller?.email ?? null,
    phoneConsent: p.seller?.phoneConsent ?? false, emailConsent: p.seller?.emailConsent ?? false,
  });
  const facts = [
    p.type,
    p.surface ? `${fmt.number(p.surface)} m²` : null,
    p.rooms ? `${p.rooms} pièce(s)` : null,
    p.price ? fmt.euros(p.price) : "prix non renseigné",
    p.price && p.surface ? fmt.perSqm(p.price / p.surface) : null,
  ].filter(Boolean).join(" · ");
  const late = p.followUpOn !== null && p.followUpOn < today;
  return (
    <li className="space-y-3 px-5 py-4" aria-label={p.addressLabel}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <Link href={`/app/proprietes/${p.id}`} className="text-sm font-medium text-ink hover:underline">
            {p.addressLabel}
          </Link>
          <p className="text-xs text-ink-muted">{facts} · suivi par {owner}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {p.favorite ? <Badge tone="warning">★ Favori</Badge> : null}
          <ProspectionBadge status={p.status} />
          <VisibilityBadge visibility={p.visibility} />
        </div>
      </div>

      <div className="space-y-1 text-sm">
        <p className="text-ink">
          {p.seller ? (
            <>
              Propriétaire :{" "}
              <Link href={`/app/contacts/${p.seller.id}`} className="font-medium hover:underline">
                {p.seller.name}
              </Link>
            </>
          ) : p.sellerHidden ? (
            "Propriétaire : contact privé d'un collègue."
          ) : (
            "Propriétaire non renseigné."
          )}
          {p.followUpOn ? (
            <span className={cn("ml-2 text-xs", late ? "font-medium text-danger" : "text-ink-muted")}>
              Prochaine tâche : {fmt.date(p.followUpOn)}
              {late ? " (en retard)" : ""}
            </span>
          ) : null}
        </p>
        {p.sellerHidden ? null : <p className="text-xs text-ink-muted">{reach.message}</p>}
        {reach.call || reach.email ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {reach.call && p.seller?.phone ? (
              <a href={`tel:${p.seller.phone.replace(/[^\d+]/g, "")}`} className={buttonClass("secondary", "sm")}>
                Appeler
              </a>
            ) : null}
            {reach.email && p.seller?.email ? (
              <a href={`mailto:${p.seller.email}`} className={buttonClass("secondary", "sm")}>
                Écrire un e-mail
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {canEdit ? (
          <ProspectionStatusForm id={p.id} status={p.status} today={today} defaultFollowUpOn={p.followUpOn && p.followUpOn >= today ? p.followUpOn : defaultFollowUpOn(today)} label={p.addressLabel} />
        ) : null}
        {canEdit ? (
          <form action={setProspectionFavoriteAction}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="favorite" value={p.favorite ? "0" : "1"} />
            <SubmitButton size="sm" variant="ghost" aria-label={`${p.favorite ? "Retirer des favoris" : "Mettre en favori"} : ${p.addressLabel}`}>
              {p.favorite ? "Retirer des favoris" : "☆ Favori"}
            </SubmitButton>
          </form>
        ) : null}
        <Link href={`/app/proprietes/${p.id}/fiche`} className={buttonClass("ghost", "sm")} aria-label={`Analyse du prix : ${p.addressLabel}`}>
          Analyse du prix
        </Link>
        {p.sourceUrl ? (
          <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className={buttonClass("ghost", "sm")} aria-label={`Voir l'annonce d'origine : ${p.addressLabel}`}>
            Voir l&apos;annonce ↗
          </a>
        ) : null}
      </div>
    </li>
  );
}
