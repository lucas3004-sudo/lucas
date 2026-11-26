/**
 * Fiche d'un bien, présentée comme une annonce : photos à faire défiler, caractéristiques,
 * description, puis l'analyse du marché (chiffres réels) et l'analyse rédigée par l'IA.
 */
import { isProspectionStatus, PROPERTY_FEATURES, PROSPECTION_LABELS, VERDICT_LABELS, type PropertyEvent } from "@immopilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { withTenant } from "@immopilot/db";
import { requireAgency } from "@/lib/agency/context";
import { getProperty } from "@/lib/crm/data";
import { PROPERTY_STATUS } from "@/lib/crm/labels";
import { fmt } from "@/lib/format";
import { listingAnalysis } from "@/lib/listing/analysis";
import { propertyActivity } from "@/lib/crm/activity";
import { getTenantPool } from "@/lib/server/db";
import { buttonClass } from "@/ui/button";
import { Badge, Card, CardBody, CardHeader } from "@/ui/surface";
import { canEditRecord, PropertyStatusBadge } from "../../../_crm/parts";
import { PhotoCarousel } from "./carousel";

export const metadata: Metadata = { title: "Fiche du bien" };

const DPE_COLORS: Record<string, string> = { A: "#009c6d", B: "#52b153", C: "#78bd76", D: "#f4e70f", E: "#f0b50f", F: "#eb8235", G: "#d7221f" };

/** Texte sombre ou blanc : celui qui contraste le mieux avec la couleur de fond (WCAG). */
function readableOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (l + 0.05) / 0.0618 >= 1.05 / (l + 0.05) ? "#111827" : "#ffffff";
}

function EnergyScale({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-ink-muted">{label}</p>
      <div className="flex gap-1" role="img" aria-label={`${label} : ${value ?? "non renseigné"}`}>
        {"ABCDEFG".split("").map((c) => (
          <span
            key={c}
            className={c === value ? "flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold ring-2 ring-ink" : "flex h-8 w-6 items-center justify-center rounded text-[11px] font-semibold opacity-35"}
            style={{ background: DPE_COLORS[c], color: readableOn(DPE_COLORS[c]!) }}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

const pct1 = (v: number) => `${(v * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

const VERDICT_TONE = { bonne_affaire: "success", prix_coherent: "brand", prix_eleve: "warning", incomplet: "neutral" } as const;

async function MarketAnalysis({ property }: { property: NonNullable<Awaited<ReturnType<typeof getProperty>>> }) {
  const a = await listingAnalysis(property);
  const est = a.snapshot?.estimate.value;
  const risks = a.snapshot?.risks.value;
  const zone = a.snapshot?.zonage.value;
  return (
    <Card>
      <CardHeader
        title="Analyse du marché"
        description="Calculée avec les ventes réelles (DVF), les loyers de l'ANIL et les risques de Géorisques. Repère, pas une expertise."
        action={<Badge tone={VERDICT_TONE[a.verdict.verdict]}>{VERDICT_LABELS[a.verdict.verdict]}</Badge>}
      />
      <CardBody className="space-y-4">
        <ul className="space-y-2 text-sm text-ink" data-testid="verdict-raisons">
          {a.verdict.reasons.map((r) => (
            <li key={r} className="flex gap-2">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
        {est && est.status === "ok" && property.price ? (
          <div>
            <p className="mb-1 text-xs font-medium text-ink-muted">Prix affiché et fourchette estimée</p>
            <div className="relative h-3 rounded-full bg-surface-muted" aria-hidden>
              {(() => {
                const min = Math.min(est.low, property.price) * 0.9;
                const max = Math.max(est.high, property.price) * 1.1;
                const pos = (v: number) => `${((v - min) / (max - min)) * 100}%`;
                return (
                  <>
                    <span className="absolute inset-y-0 rounded-full bg-brand-soft" style={{ left: pos(est.low), right: `calc(100% - ${pos(est.high)})` }} />
                    <span className="absolute -top-1 h-5 w-1 rounded bg-ink" style={{ left: pos(property.price) }} />
                  </>
                );
              })()}
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Fourchette : {fmt.euros(est.low)} – {fmt.euros(est.high)} · prix affiché : {fmt.euros(property.price)}
            </p>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--radius-control)] bg-surface-muted p-3">
            <p className="text-xs text-ink-muted">Rendement locatif brut</p>
            <p className="text-lg font-semibold text-ink">
              {a.verdict.grossYield ? `${pct1(a.verdict.grossYield.low)} à ${pct1(a.verdict.grossYield.high)}` : "—"}
            </p>
          </div>
          <div className="rounded-[var(--radius-control)] bg-surface-muted p-3">
            <p className="text-xs text-ink-muted">Risques recensés (commune)</p>
            <p className="text-lg font-semibold text-ink">{risks ? risks.risks.length : "—"}</p>
            {risks?.officialReportUrl ? (
              <a href={risks.officialReportUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-text underline">
                Rapport officiel Géorisques
              </a>
            ) : null}
          </div>
          <div className="rounded-[var(--radius-control)] bg-surface-muted p-3">
            <p className="text-xs text-ink-muted">Zonage (investissement locatif)</p>
            <p className="text-lg font-semibold text-ink">{zone ? `Zone ${zone.zone}` : "—"}</p>
          </div>
        </div>
        {risks && risks.risks.length ? (
          <p className="text-xs text-ink-muted">Risques : {risks.risks.map((r) => r.label).join(", ")}.</p>
        ) : null}
      </CardBody>
    </Card>
  );
}

const dayFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" });
const signedPct = (v: number) => `${v > 0 ? "+" : "−"}${Math.abs(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
const euro = (v: string | null) => (v && Number.isFinite(Number(v)) ? fmt.euros(Number(v)) : "prix non renseigné");

function eventLabel(e: PropertyEvent): string {
  switch (e.kind) {
    case "cree":
      return e.newValue ? `Bien ajouté, à ${euro(e.newValue)}` : "Bien ajouté";
    case "prix":
      return `Prix : ${euro(e.oldValue)} → ${euro(e.newValue)}`;
    case "statut":
      return `Statut : ${PROPERTY_STATUS[e.oldValue as keyof typeof PROPERTY_STATUS] ?? e.oldValue} → ${PROPERTY_STATUS[e.newValue as keyof typeof PROPERTY_STATUS] ?? e.newValue}`;
    case "mandat":
      if (e.newValue === e.oldValue) return "Mandat mis à jour";
      return e.newValue ? `Mandat ${e.newValue === "exclusif" ? "exclusif" : "simple"}` : "Mandat retiré";
    case "prospection": {
      const label = (v: string | null) => (isProspectionStatus(v) ? PROSPECTION_LABELS[v] : v);
      if (!e.newValue) return "Retiré de la prospection";
      return e.oldValue ? `Prospection : ${label(e.oldValue)} → ${label(e.newValue)}` : `Ajouté à la prospection (${label(e.newValue)})`;
    }
  }
}

/** Historique et activité (D-061) : depuis quand le bien est en vente, son prix, son intérêt. */
async function ActivityCard({ property }: { property: NonNullable<Awaited<ReturnType<typeof getProperty>>> }) {
  const { events, history, visits, interested, deals } = await propertyActivity(await requireAgency(), property);
  const tiles: [string, string, string?][] = [
    ["En vente depuis", history.daysOnMarket === null ? "Pas en vente" : `${history.daysOnMarket} jour(s)`, history.listedOn ? `depuis le ${dayFmt.format(history.listedOn)}` : undefined],
    ["Évolution du prix", history.totalChange === null ? "Inchangé" : signedPct(history.totalChange), history.firstPrice && history.totalChange !== null ? `prix de départ ${fmt.euros(history.firstPrice)}` : undefined],
    ["Acquéreurs intéressés", String(interested), "profils de l'agence qui correspondent"],
    ["Visites", String(visits.visits), visits.visits ? `dont ${visits.byInterest.fort} avec un intérêt fort` : "aucun compte rendu"],
    ["Affaires", String(deals.length), deals.length ? "offre ou vente en cours" : "aucune offre"],
  ];
  return (
    <section aria-labelledby="historique">
      <h2 id="historique" className="mb-3 font-display text-lg font-semibold tracking-[-0.02em] text-ink">Historique et activité</h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="activite">
        {tiles.map(([k, v, sub]) => (
          <div key={k} className="rounded-2xl border border-line bg-surface p-3.5">
            <dt className="text-xs text-ink-muted">{k}</dt>
            <dd className="mt-1 font-display text-xl font-semibold tracking-[-0.02em] text-ink">{v}</dd>
            {sub ? <dd className="text-xs text-ink-muted">{sub}</dd> : null}
          </div>
        ))}
      </dl>
      <ol className="mt-4 space-y-0 border-l border-line pl-4" aria-label="Chronologie du bien">
        {[...events].reverse().map((e, i) => (
          <li key={i} className="relative pb-3 text-sm">
            <span aria-hidden className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-brand" />
            <span className="text-ink">{eventLabel(e)}</span>
            {e.kind === "prix" ? (
              <span className="ml-2 align-middle">
                <Badge tone={Number(e.newValue) < Number(e.oldValue) ? "success" : "warning"}>
                  {signedPct(Number(e.newValue) / Number(e.oldValue) - 1)}
                </Badge>
              </span>
            ) : null}
            <span className="block text-xs text-ink-muted">{dayFmt.format(e.at)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default async function PropertySheetPage({ params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const ctx = await requireAgency();
  const property = await getProperty(ctx, id.data);
  if (!property) notFound();
  const photos = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    (await c.query<{ id: string }>("SELECT id FROM app.property_photos WHERE property_id = $1 ORDER BY position, created_at", [property.id])).rows);
  const perSqm = property.price && property.surface ? property.price / property.surface : null;
  const canEdit = canEditRecord(ctx, property.owner_user_id);

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-3 text-sm text-ink-muted">
        <Link href="/app/carte" className="hover:text-ink">Carte</Link>
        <span aria-hidden> · </span>
        <Link href={`/app/proprietes/${property.id}`} className="hover:text-ink">Gestion du bien</Link>
      </nav>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <PhotoCarousel photos={photos} label={property.address_label} />
          <section aria-labelledby="description">
            <h2 id="description" className="mb-2 text-lg font-semibold text-ink">{property.listing_title ?? "Description"}</h2>
            {property.listing_description ? (
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{property.listing_description}</p>
            ) : (
              <p className="text-sm text-ink-muted">
                Pas encore de description.{" "}
                {canEdit ? <Link href={`/app/proprietes/${property.id}/annonce`} className="text-brand-text underline">Rédiger l&apos;annonce</Link> : null}
              </p>
            )}
          </section>
          <section aria-labelledby="caracteristiques">
            <h2 id="caracteristiques" className="mb-3 text-lg font-semibold text-ink">Caractéristiques</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {[
                ["Type", property.type],
                ["Surface", property.surface ? `${fmt.number(property.surface)} m²` : "—"],
                ["Pièces", property.rooms ? String(property.rooms) : "—"],
                ["Prix au m²", perSqm ? `${fmt.number(perSqm)} €` : "—"],
                ["Copropriété", property.is_copro === null ? "—" : property.is_copro ? `Oui${property.copro_lots ? `, ${property.copro_lots} lots` : ""}` : "Non"],
                ["Charges annuelles", property.copro_annual_charges ? fmt.euros(property.copro_annual_charges) : "—"],
                ["Dépenses d'énergie", property.energy_cost_low && property.energy_cost_high ? `${fmt.euros(property.energy_cost_low)} – ${fmt.euros(property.energy_cost_high)} par an` : "—"],
                ["Mandat", property.mandate_type ? `${property.mandate_type}${property.mandate_number ? ` (n° ${property.mandate_number})` : ""}` : "—"],
                ["Statut", PROPERTY_STATUS[property.status]],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-ink-muted">{k}</dt>
                  <dd className="font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {property.features.length ? (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Équipements">
                {property.features.map((f) => (
                  <li key={f} className="rounded-full border border-line-strong px-3 py-1 text-sm text-ink">{PROPERTY_FEATURES[f]}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-6">
              <EnergyScale label="Classe énergie (DPE)" value={property.dpe_class} />
              <EnergyScale label="Classe climat (GES)" value={property.ges_class} />
            </div>
          </section>
          <Suspense fallback={<p className="text-sm text-ink-muted">Chargement de l&apos;historique…</p>}>
            <ActivityCard property={property} />
          </Suspense>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardBody className="space-y-2">
              <p className="text-3xl font-semibold tracking-tight text-ink">{property.price ? fmt.euros(property.price) : "Prix non renseigné"}</p>
              <p className="text-sm text-ink-muted">
                {property.type}{property.surface ? ` · ${fmt.number(property.surface)} m²` : ""}{property.rooms ? ` · ${property.rooms} pièces` : ""}
                {perSqm ? ` · ${fmt.number(perSqm)} €/m²` : ""}
              </p>
              <h1 className="text-base font-medium text-ink">{property.address_label}</h1>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <PropertyStatusBadge status={property.status} />
              </div>
              <div className="flex flex-wrap gap-2 pt-3">
                <Link href={`/app/proprietes/${property.id}`} className={buttonClass("secondary", "sm")}>Gérer le bien</Link>
                <Link href={`/app/proprietes/${property.id}/annonce`} className={buttonClass("ghost", "sm")}>Annonce et mentions</Link>
                <Link href={`/app/agenda?bien=${property.id}`} className={buttonClass("ghost", "sm")}>Planifier une visite</Link>
              </div>
            </CardBody>
          </Card>
          <Suspense fallback={<Card><CardBody><p className="text-sm text-ink-muted">Analyse du marché en cours…</p></CardBody></Card>}>
            <MarketAnalysis property={property} />
          </Suspense>
        </aside>
      </div>
    </>
  );
}
