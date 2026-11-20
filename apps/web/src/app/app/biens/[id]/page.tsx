import { schema, withTenant } from "@immopilot/db";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireAgency } from "@/lib/agency/context";
import { getAuth } from "@/lib/auth/server";
import { deleteDossierAction } from "@/lib/dossier/actions";
import type { DossierSnapshot } from "@/lib/dossier/types";
import { fmt } from "@/lib/format";
import { getTenantPool } from "@/lib/server/db";
import { buttonClass, LinkButton } from "@/ui/button";
import { MissingNote, SourceLine, StatusBadge } from "@/ui/provenance";
import { Badge, Card, CardBody, CardHeader } from "@/ui/surface";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Dossier de bien" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONFIDENCE = { elevee: { label: "Confiance élevée", tone: "success" }, moyenne: { label: "Confiance moyenne", tone: "warning" }, faible: { label: "Confiance faible", tone: "danger" } } as const;

// Couleurs réglementaires des étiquettes DPE (A vert foncé → G rouge).
const DPE_COLORS: Record<string, string> = { A: "#009c6d", B: "#52b153", C: "#78bd76", D: "#f4e70f", E: "#f0b50f", F: "#eb8235", G: "#d7221f" };

function DpeLabel({ value }: { value: string }) {
  const dark = value === "D" || value === "E";
  return (
    <span className="inline-flex size-7 items-center justify-center rounded-md text-sm font-bold" style={{ background: DPE_COLORS[value] ?? "#999", color: dark ? "#1a1a1a" : "#fff" }}>
      {value || "?"}
    </span>
  );
}

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await requireAgency();
  const [row] = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, (db) =>
    db.select().from(schema.analyses).where(eq(schema.analyses.id, id)).limit(1),
  );
  if (!row) notFound();
  const snap = row.snapshot as unknown as DossierSnapshot;
  const full = await getAuth().api.getFullOrganization({ headers: await headers(), query: { organizationId: ctx.org.id } });
  const author = full?.members.find((m) => m.userId === row.createdBy)?.user.name ?? "Ancien membre";
  const inputs = snap.inputs.value!;
  const est = snap.estimate.value;
  const market = snap.market.value;
  // Investment Studio : l'adresse et le repère de loyer ANIL (charges comprises) sont transmis ;
  // le prix et le loyer hors charges restent à saisir (ce sont des hypothèses du projet).
  const rentRef = snap.rent.value;
  const simulationLink = `/app/investissement?${new URLSearchParams({
    bien: snap.address.value?.label ?? row.addressLabel,
    ...(rentRef ? { repere_bas: String(Math.round(rentRef.monthlyLow)), repere_haut: String(Math.round(rentRef.monthlyHigh)) } : {}),
  })}`;

  return (
    <article className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-brand-text">Dossier de bien</p>
          <h1 className="mt-0.5 text-[22px] font-semibold tracking-tight text-ink">{snap.address.value?.label ?? row.addressLabel}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {inputs.type} · {fmt.number(inputs.surface)} m²{inputs.rooms ? ` · ${inputs.rooms} pièce(s)` : ""} <StatusBadge status="declaree" /> · calculé le {fmt.date(snap.computedAt)} par {author}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <PrintButton />
          <LinkButton href={simulationLink} variant="secondary">Simuler un investissement</LinkButton>
          <LinkButton href="/app/biens/nouveau" variant="secondary">Nouveau dossier</LinkButton>
          {ctx.role === "gerant" || ctx.role === "manager" ? (
            <form action={deleteDossierAction}>
              <input type="hidden" name="id" value={row.id} />
              <button type="submit" className={buttonClass("ghost")}>Supprimer</button>
            </form>
          ) : null}
        </div>
      </header>

      <div className="rounded-[var(--radius-control)] border border-line bg-surface-muted px-4 py-3 text-[13px] text-ink-muted">
        <strong className="text-ink">Estimation indicative, pas une expertise.</strong> Elle repose uniquement sur des données publiques et sur
        les caractéristiques déclarées. L&apos;état du bien, l&apos;étage, l&apos;exposition ou les travaux ne sont pas pris en compte.
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Estimation indicative" action={<StatusBadge status={snap.estimate.status} />} />
          <CardBody className="space-y-3">
            {est && est.status === "ok" ? (
              <>
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                  <p className="tabular text-[28px] font-semibold tracking-tight text-ink">
                    {fmt.euros(est.low)} <span className="text-ink-subtle">–</span> {fmt.euros(est.high)}
                  </p>
                  <Badge tone={CONFIDENCE[est.confidence].tone}>{CONFIDENCE[est.confidence].label}</Badge>
                </div>
                <p className="text-sm text-ink">
                  Valeur centrale : <strong className="tabular">{fmt.euros(est.mid)}</strong> · prix au m² : {fmt.perSqm(est.stats.q1)} à {fmt.perSqm(est.stats.q3)} (médiane {fmt.perSqm(est.stats.median)})
                </p>
                {market ? (
                  <p className="text-[13px] text-ink-muted">
                    Méthode : quartiles des prix au m² de <strong>{est.comparables}</strong> ventes de {inputs.type === "Maison" ? "maisons" : "appartements"} anciens de {fmt.number(inputs.surface * 0.5)} à {fmt.number(inputs.surface * 1.5)} m², dans un rayon de {fmt.distance(market.radiusM)}, du {fmt.date(market.from)} au {fmt.date(market.to)}, appliqués à la surface déclarée. Arrondi au millier d&apos;euros.
                  </p>
                ) : null}
              </>
            ) : (
              <MissingNote note={snap.estimate.note ?? snap.market.note} />
            )}
            <SourceLine source={snap.estimate.source} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Loyer de marché" action={<StatusBadge status={snap.rent.status} />} />
          <CardBody className="space-y-2">
            {snap.rent.value ? (
              <>
                <p className="tabular text-xl font-semibold text-ink">
                  {fmt.euros(snap.rent.value.monthlyLow)} – {fmt.euros(snap.rent.value.monthlyHigh)} <span className="text-sm font-normal text-ink-muted">/ mois</span>
                </p>
                <p className="text-[13px] text-ink-muted">
                  {fmt.decimal(snap.rent.value.low)} à {fmt.decimal(snap.rent.value.high)} €/m² (centre {fmt.decimal(snap.rent.value.perSqm)}). {snap.rent.note}
                </p>
                {!snap.rent.value.reliable ? <Badge tone="warning">Modèle peu fiable pour cette commune</Badge> : null}
              </>
            ) : (
              <MissingNote note={snap.rent.note} />
            )}
            <SourceLine source={snap.rent.source} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Ventes comparables"
          description="Les plus proches d'abord. Adresses non affichées, conformément aux conditions de réutilisation des données DVF."
          action={<StatusBadge status={snap.market.status} />}
        />
        {market && market.comparables.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-[12px] uppercase tracking-wide text-ink-muted">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Surface</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Prix</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Prix au m²</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Distance</th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-line">
                {market.comparables.slice(0, 15).map((c) => (
                  <tr key={c.mutationId}>
                    <td className="whitespace-nowrap px-5 py-2.5 text-ink-muted">{fmt.month(c.date)}</td>
                    <td className="px-5 py-2.5 text-right text-ink">{fmt.number(c.surface)} m²</td>
                    <td className="px-5 py-2.5 text-right text-ink">{fmt.euros(c.price)}</td>
                    <td className="px-5 py-2.5 text-right text-ink">{fmt.perSqm(c.pricePerSqm)}</td>
                    <td className="px-5 py-2.5 text-right text-ink-muted">{fmt.distance(c.distanceM)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <CardBody>
            <MissingNote note={snap.market.note} />
          </CardBody>
        )}
        <div className="px-5 pb-4">
          <SourceLine source={snap.market.source} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Performance énergétique (DPE)" action={<StatusBadge status={snap.dpe.status} />} />
          <CardBody className="space-y-3">
            {snap.dpe.value && snap.dpe.value.length ? (
              <>
                {snap.dpe.value.length > 1 ? (
                  <p className="text-[13px] text-warning">
                    {snap.dpe.value.length} DPE à cette adresse (immeuble) : vérifiez celui qui correspond au logement.
                  </p>
                ) : null}
                <ul className="divide-y divide-line">
                  {snap.dpe.value.slice(0, 6).map((d) => (
                    <li key={d.numero} className="flex flex-wrap items-center gap-3 py-2.5">
                      <DpeLabel value={d.energyClass} />
                      <DpeLabel value={d.climateClass} />
                      <div className="min-w-0 flex-1 text-[13px]">
                        <p className="text-ink">
                          {d.surface ? `${fmt.number(d.surface)} m² · ` : ""}DPE du {fmt.date(d.date)}
                          {d.annualCost ? ` · ${fmt.euros(d.annualCost)} d'énergie / an (estimation)` : ""}
                        </p>
                        <p className="text-ink-muted">
                          N° {d.numero}
                          {d.heatingEnergy ? ` · chauffage : ${d.heatingEnergy}` : ""}
                        </p>
                      </div>
                      {d.expired ? <Badge tone="danger">Expiré</Badge> : null}
                      {d.electricityCoefficientChange ? <Badge tone="warning">Classe susceptible d&apos;avoir changé (2026)</Badge> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <MissingNote note={snap.dpe.note} />
            )}
            <SourceLine source={snap.dpe.source} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Risques (Géorisques)" action={<StatusBadge status={snap.risks.status} />} />
          <CardBody className="space-y-3">
            {snap.risks.value ? (
              snap.risks.value.risks.length ? (
                <table className="w-full text-left text-[13px]">
                  <thead className="text-[11px] uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th scope="col" className="py-1.5 font-medium">Risque</th>
                      <th scope="col" className="py-1.5 font-medium">Commune</th>
                      <th scope="col" className="py-1.5 font-medium">Adresse</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {snap.risks.value.risks.map((r) => (
                      <tr key={r.key}>
                        <td className="py-2 pr-3 text-ink">{r.label}</td>
                        <td className="py-2 pr-3 text-ink-muted">{r.commune ?? "—"}</td>
                        <td className="py-2 text-ink">{r.address ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-ink">Aucun risque recensé dans la commune.</p>
              )
            ) : (
              <MissingNote note={snap.risks.note} />
            )}
            <SourceLine source={snap.risks.source} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Marché local" action={<StatusBadge status={snap.zonage.status} />} />
        <CardBody className="space-y-1">
          {snap.zonage.value ? (
            <p className="text-sm text-ink">
              Zone <strong>{snap.zonage.value.zone}</strong> du zonage ABC
              {snap.zonage.value.inForceFrom ? ` (en vigueur depuis le ${fmt.date(snap.zonage.value.inForceFrom)})` : ""}. De A bis (marché le plus tendu) à C (le moins tendu).
            </p>
          ) : (
            <MissingNote note={snap.zonage.note} />
          )}
          <SourceLine source={snap.zonage.source} />
        </CardBody>
      </Card>

      <p className="text-xs text-ink-subtle">
        Dossier n° {row.id} · instantané figé le {fmt.date(snap.computedAt)} : les données ne changent pas après sa création. Recalculez un
        nouveau dossier pour intégrer les dernières données publiques.
      </p>
    </article>
  );
}
