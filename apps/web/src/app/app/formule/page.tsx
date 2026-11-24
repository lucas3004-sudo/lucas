import { centsLabel, MAX_OVERAGE_CAP_CENTS, METRIC_LABELS, monthlyPrice, MONTHLY_METRICS, OVERAGE_UNIT_CENTS, parisMonthStart, PLANS, type Plan, type QuotaMetric } from "@immopilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/agency/context";
import { aiConfig } from "@/lib/ai/config";
import { setOverageCapAction } from "@/lib/billing/actions";
import { overageState } from "@/lib/billing/overage";
import { agencyPlanAndUsage, quotaFor } from "@/lib/billing/plan";
import { fmt } from "@/lib/format";
import { cn } from "@/ui/cn";
import { SubmitButton } from "@/ui/client";
import { Field, Input } from "@/ui/form";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/ui/surface";

export const metadata: Metadata = { title: "Formule et consommation" };

const METRICS: QuotaMetric[] = ["dossiers", "contacts", "membres", "copilot", "annonces_ia"];
const AI_METRICS = new Set<QuotaMetric>(["copilot", "annonces_ia"]);
const COMPARED: Plan[] = [PLANS.investisseur, PLANS.solo, PLANS.pro, PLANS.agency];
const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "Europe/Paris" });

function priceLabel(plan: Plan, extraSeats = 0) {
  const price = monthlyPrice(plan, extraSeats);
  return price === null ? "Gratuit" : `${fmt.euros(price)} HT / mois`;
}

function limitLabel(limit: number | null) {
  if (limit === null) return "illimité";
  if (limit === 0) return "non inclus";
  return fmt.number(limit);
}

const CAP_MESSAGES: Record<string, { tone: "success" | "danger"; text: string }> = {
  ok: { tone: "success", text: "Plafond des crédits IA enregistré." },
  invalide: { tone: "danger", text: `Plafond invalide : indiquez un montant entre 0 et ${MAX_OVERAGE_CAP_CENTS / 100} €.` },
  gerant: { tone: "danger", text: "Seul le gérant peut modifier le plafond des crédits IA." },
};

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ plafond?: string }> }) {
  const ctx = await requireAgency();
  const [{ current, usage }, overage, { plafond }] = await Promise.all([agencyPlanAndUsage(ctx), overageState(ctx), searchParams]);
  const capMessage = plafond ? CAP_MESSAGES[plafond] : undefined;
  const resetDay = `1er ${monthName.format(parisMonthStart(new Date(), 1))}`;
  const aiEnabled = aiConfig().enabled;

  return (
    <>
      <PageHeader
        title="Formule et consommation"
        description={`Formule ${current.plan.name} : ${current.plan.description}`}
      />
      <div className="space-y-4">
        <Alert tone="brand">
          {current.assigned ? "Formule active de votre agence." : "Votre agence est en essai gratuit."}{" "}
          <Link href="/abonnement" className="font-medium underline">Choisir ou gérer l&apos;abonnement</Link>
        </Alert>

        <Card>
          <CardHeader
            title="Consommation"
            description={`Quotas partagés par toute l'agence. Les compteurs mensuels repartent à zéro le ${resetDay}.`}
            action={<Badge tone="brand">{priceLabel(current.plan, current.extraSeats)}</Badge>}
          />
          <ul className="divide-y divide-line">
            {METRICS.map((metric) => {
              const check = quotaFor(current, usage, metric, 0);
              // Tant que l'IA est éteinte (pas de clé), ses quotas ne sont pas consommés.
              const ai = AI_METRICS.has(metric) && !aiEnabled;
              const ratio = check.limit ? Math.min(1, check.used / check.limit) : 0;
              const full = check.limit !== null && check.limit > 0 && check.used >= check.limit;
              // Au-delà du forfait, les échanges IA peuvent continuer à l'usage (D-065).
              const payAsYouGo = full && AI_METRICS.has(metric) && overage.billable && overage.capCents > 0;
              const extra = metric === "copilot" ? overage.month.copilot : metric === "annonces_ia" ? overage.month.annonces : 0;
              return (
                <li key={metric} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm text-ink">{METRIC_LABELS[metric]}</span>
                    <span className="tabular text-sm text-ink-muted" data-testid={`usage-${metric}`}>
                      {ai ? (
                        <Badge>IA non activée</Badge>
                      ) : (
                        <>
                          <span className="font-medium text-ink">{fmt.number(check.used)}</span>
                          {check.limit === null ? " (illimité)" : ` sur ${limitLabel(check.limit)}`}
                          {extra ? ` · ${fmt.number(extra)} à l'usage` : ""}
                        </>
                      )}
                    </span>
                  </div>
                  {!ai && check.limit ? (
                    <div
                      role="progressbar"
                      aria-label={METRIC_LABELS[metric]}
                      aria-valuemin={0}
                      aria-valuemax={check.limit}
                      aria-valuenow={Math.min(check.used, check.limit)}
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"
                    >
                      <div
                        className={cn("bar-in h-full rounded-full", full ? "bg-danger" : ratio >= 0.8 ? "bg-warning" : "bg-brand")}
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </div>
                  ) : null}
                  {metric === "membres" && usage.membres > 0 ? (
                    <p className="mt-1 text-xs text-ink-muted">Les invitations en attente comptent : elles réservent une place.</p>
                  ) : null}
                  {payAsYouGo ? (
                    <p className="mt-1 text-xs text-ink-muted">Forfait épuisé : les suivants sont facturés à l&apos;usage, dans la limite du plafond de l&apos;agence.</p>
                  ) : full ? (
                    <p className="mt-1 text-xs text-danger">Quota atteint : les nouveaux ajouts sont refusés{MONTHLY_METRICS.includes(metric) ? ` jusqu'au ${resetDay}` : ""}.</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Crédits IA à l'usage"
            description={`Une fois les échanges inclus épuisés, l'agence continue sans limite de formule : ${centsLabel(OVERAGE_UNIT_CENTS.copilot * 100)} les 100 échanges avec l'assistant, ${centsLabel(OVERAGE_UNIT_CENTS.annonces_ia)} l'annonce rédigée par IA, ajoutés à la facture suivante.`}
          />
          <CardBody className="space-y-4 text-sm">
            {capMessage ? <Alert tone={capMessage.tone}>{capMessage.text}</Alert> : null}
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-ink-muted">Ce mois-ci</dt>
                <dd className="tabular font-display text-[22px] font-semibold text-ink" data-testid="credits-mois">{centsLabel(overage.month.cents)}</dd>
                <dd className="text-xs text-ink-muted">
                  {fmt.number(overage.month.copilot)} échange(s), {fmt.number(overage.month.annonces)} annonce(s) au-delà du forfait
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Plafond mensuel</dt>
                <dd className="tabular font-display text-[22px] font-semibold text-ink" data-testid="credits-plafond">
                  {overage.capCents === 0 ? "Désactivé" : centsLabel(overage.capCents)}
                </dd>
                <dd className="text-xs text-ink-muted">{overage.defaultCap ? "Réglage par défaut" : "Choisi par le gérant"} ; au-delà, l&apos;IA s&apos;arrête jusqu&apos;au {resetDay}.</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Facturation</dt>
                <dd className="text-ink">{overage.billable ? "Active (abonnement payant)" : "Disponible avec un abonnement payant"}</dd>
              </div>
            </dl>
            {ctx.role === "gerant" ? (
              <form action={setOverageCapAction} className="flex flex-wrap items-end gap-3">
                <div className="w-48">
                  <Field label="Plafond mensuel (€)" htmlFor="plafond" hint="0 pour désactiver les crédits à l'usage.">
                    <Input id="plafond" name="plafond" inputMode="decimal" defaultValue={String(overage.capCents / 100).replace(".", ",")} required />
                  </Field>
                </div>
                <SubmitButton variant="secondary">Enregistrer le plafond</SubmitButton>
              </form>
            ) : (
              <p className="text-xs text-ink-muted">Seul le gérant peut modifier le plafond.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Les formules" description={aiEnabled ? "Grille de lancement, prix hors taxes. Les échanges avec l'assistant IA comptent dans le quota de l'agence." : "Grille de lancement, prix hors taxes. L'IA n'est pas encore activée : ses quotas s'appliqueront dès son ouverture."} />
          <div role="region" aria-label="Comparaison des formules (défilable)" tabIndex={0} className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">Comparaison des formules et de leurs quotas</caption>
              <thead className="bg-surface-muted text-left text-xs text-ink-muted">
                <tr>
                  <th scope="col" className="px-5 py-2 font-medium">Quota</th>
                  {COMPARED.map((p) => (
                    <th key={p.id} scope="col" className={cn("px-3 py-2 font-medium", p.id === current.plan.id && "text-brand-text")}>
                      {p.name}
                      <span className="block font-normal">{priceLabel(p)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {METRICS.map((metric) => (
                  <tr key={metric}>
                    <th scope="row" className="px-5 py-2 text-left font-normal text-ink">{METRIC_LABELS[metric]}</th>
                    {COMPARED.map((p) => (
                      <td key={p.id} className="tabular px-3 py-2 text-ink-muted">
                        {limitLabel(p.quotas[metric])}
                        {metric === "membres" && p.extraSeatEur ? ` (+${fmt.euros(p.extraSeatEur)} par membre en plus)` : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
