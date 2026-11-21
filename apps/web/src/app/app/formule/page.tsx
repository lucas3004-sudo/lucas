import { METRIC_LABELS, monthlyPrice, MONTHLY_METRICS, parisMonthStart, PLANS, type Plan, type QuotaMetric } from "@immopilot/domain";
import type { Metadata } from "next";
import { requireAgency } from "@/lib/agency/context";
import { agencyPlanAndUsage, quotaFor } from "@/lib/billing/plan";
import { fmt } from "@/lib/format";
import { cn } from "@/ui/cn";
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

export default async function PlanPage() {
  const ctx = await requireAgency();
  const { current, usage } = await agencyPlanAndUsage(ctx);
  const resetDay = `1er ${monthName.format(parisMonthStart(new Date(), 1))}`;

  return (
    <>
      <PageHeader
        title="Formule et consommation"
        description={`Formule ${current.plan.name} : ${current.plan.description}`}
      />
      <div className="space-y-4">
        <Alert tone="brand">
          Préproduction : aucun paiement n&apos;est encaissé.{" "}
          {current.assigned
            ? "Votre formule a été attribuée par l'équipe ImmoPilot."
            : "Sans formule attribuée, votre agence est en Essai."}{" "}
          Le changement de formule se fera ici à l&apos;ouverture du paiement en ligne.
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
              const ai = AI_METRICS.has(metric);
              const ratio = check.limit ? Math.min(1, check.used / check.limit) : 0;
              const full = check.limit !== null && check.limit > 0 && check.used >= check.limit;
              return (
                <li key={metric} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm text-ink">{METRIC_LABELS[metric]}</span>
                    <span className="tabular text-sm text-ink-muted" data-testid={`usage-${metric}`}>
                      {ai ? (
                        <Badge>IA non activée</Badge>
                      ) : (
                        <>
                          <span className="font-medium text-ink">{fmt.number(check.used)}</span> sur {limitLabel(check.limit)}
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
                        className={cn("h-full rounded-full", full ? "bg-danger" : ratio >= 0.8 ? "bg-warning" : "bg-brand")}
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </div>
                  ) : null}
                  {metric === "membres" && usage.membres > 0 ? (
                    <p className="mt-1 text-xs text-ink-muted">Les invitations en attente comptent : elles réservent une place.</p>
                  ) : null}
                  {full ? <p className="mt-1 text-xs text-danger">Quota atteint : les nouveaux ajouts sont refusés{MONTHLY_METRICS.includes(metric) ? ` jusqu'au ${resetDay}` : ""}.</p> : null}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Les formules" description="Grille de lancement, prix hors taxes. L'IA n'est pas encore activée : ses quotas s'appliqueront dès son ouverture." />
          <CardBody className="overflow-x-auto p-0">
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
          </CardBody>
        </Card>
      </div>
    </>
  );
}
