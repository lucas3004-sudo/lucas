import { sensitivity, simulate, SENSITIVITY_STEPS } from "@immopilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/agency/context";
import { fmt } from "@/lib/format";
import { INPUT_GROUPS, INPUT_LABELS, parseSimulation } from "@/lib/invest/params";
import { buttonClass } from "@/ui/button";
import { cn } from "@/ui/cn";
import { Field, Input } from "@/ui/form";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/ui/surface";

export const metadata: Metadata = { title: "Investissement" };

type Search = Partial<Record<string, string | string[]>>;

const step = (s: number) => (s > 0 ? `+${s} %` : s < 0 ? `\u2212${-s} %` : "0 %");

function Line({ label, value, strong, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-sm text-ink-muted">
        {label}
        {hint ? <span className="block text-xs text-ink-subtle">{hint}</span> : null}
      </dt>
      <dd className={cn("tabular text-right text-sm text-ink", strong && "font-semibold")}>{value}</dd>
    </div>
  );
}

export default async function InvestmentPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAgency();
  const params = await searchParams;
  const { inputs, errors, submitted, rentReference, subject } = parseSimulation(params);
  const ready = submitted && errors.length === 0;
  const result = ready ? simulate(inputs) : null;
  const grid = ready ? sensitivity(inputs) : null;
  const keep = subject ? { bien: subject } : {};
  const refParams = rentReference ? { repere_bas: String(rentReference.low), repere_haut: String(rentReference.high) } : {};

  return (
    <>
      <PageHeader
        title="Investissement"
        description={
          subject
            ? `Simulation locative pour ${subject}. Toutes les hypothèses sont modifiables.`
            : "Simulation d'un investissement locatif : rendement, mensualité, cash-flow et sensibilité. Toutes les hypothèses sont modifiables."
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader title="Hypothèses" description="Valeurs par défaut indicatives : remplacez-les par celles du projet." />
          <form method="get" className="space-y-5 px-5 py-4">
            {Object.entries({ ...keep, ...refParams }).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            {rentReference ? (
              <Alert tone="brand">
                Repère de marché (carte des loyers ANIL) : {fmt.euros(rentReference.low)} à {fmt.euros(rentReference.high)} par mois,{" "}
                <strong>charges comprises</strong>, loyers d&apos;annonce. Le loyer hors charges réellement signé est généralement plus bas.
              </Alert>
            ) : null}
            {INPUT_GROUPS.map((group) => (
              <fieldset key={group.title} className="space-y-3">
                <legend className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">{group.title}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.keys.map((key) => {
                    const meta = INPUT_LABELS[key];
                    const invalid = errors.includes(key);
                    const raw = params[key];
                    return (
                      <Field key={key} label={`${meta.label} (${meta.unit})`} htmlFor={key} hint={invalid ? <span className="text-danger">Valeur invalide ou hors limites.</span> : meta.hint}>
                        <Input
                          id={key}
                          name={key}
                          inputMode="decimal"
                          required={key === "price"}
                          aria-invalid={invalid || undefined}
                          defaultValue={typeof raw === "string" ? raw : key === "price" ? "" : String(inputs[key])}
                          className={invalid ? "border-danger" : undefined}
                        />
                      </Field>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <div className="flex gap-2">
              <button type="submit" className={buttonClass("primary")}>
                Calculer
              </button>
              <Link href="/app/investissement" className={buttonClass("ghost")}>
                Tout effacer
              </Link>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          {!submitted ? (
            <Card>
              <CardBody>
                <p className="text-sm text-ink">Saisissez au moins le prix d&apos;achat et le loyer, puis « Calculer ».</p>
                <p className="mt-1 text-sm text-ink-muted">
                  Le lien de la page contient la simulation : vous pouvez le copier pour la retrouver ou la partager.
                </p>
              </CardBody>
            </Card>
          ) : errors.length ? (
            <Alert tone="danger">Corrigez les valeurs signalées pour lancer le calcul ({errors.length}).</Alert>
          ) : result && grid ? (
            <>
              <Card>
                <CardHeader title="Résultats" description="Avant impôt. Rendements calculés sur le coût total d'acquisition." />
                <CardBody>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-[13px] text-ink-muted">Rendement brut</p>
                      <p className="tabular text-2xl font-semibold tracking-tight text-ink">{fmt.percent(result.grossYield)}</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-ink-muted">Rendement net de charges</p>
                      <p className="tabular text-2xl font-semibold tracking-tight text-ink">{fmt.percent(result.netYield)}</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-ink-muted">Cash-flow mensuel</p>
                      <p className={cn("tabular text-2xl font-semibold tracking-tight", result.monthlyCashFlow >= 0 ? "text-success" : "text-danger")}>
                        {fmt.signedEuros(result.monthlyCashFlow)}
                      </p>
                    </div>
                  </div>
                  <dl className="mt-4 divide-y divide-line border-t border-line">
                    <Line label="Frais d'acquisition" value={fmt.euros(result.acquisitionFees)} />
                    <Line label="Coût total d'acquisition" value={fmt.euros(result.totalCost)} strong hint="Prix + frais + honoraires + travaux + mobilier" />
                    <Line label="Montant emprunté" value={fmt.euros(result.loanAmount)} />
                    <Line label="Mensualité du prêt (hors assurance)" value={fmt.euros(result.monthlyLoanPayment)} />
                    <Line label="Assurance emprunteur" value={`${fmt.euros(result.monthlyLoanInsurance)} / mois`} />
                    <Line label="Coût total des intérêts" value={fmt.euros(result.totalInterest)} />
                    <Line label="Loyers annuels (sans vacance)" value={fmt.euros(result.annualRentPotential)} />
                    <Line label="Loyers encaissés par an" value={fmt.euros(result.annualRentCollected)} />
                    <Line label="Charges annuelles" value={fmt.euros(result.annualCharges)} hint={result.managementFees ? `dont gestion locative ${fmt.euros(result.managementFees)}` : undefined} />
                    <Line label="Cash-flow annuel" value={fmt.signedEuros(result.annualCashFlow)} strong />
                  </dl>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Sensibilité au prix et au loyer" description="Cash-flow mensuel (et rendement net) si le prix ou le loyer varie. Les frais et l'emprunt suivent le prix ; l'apport reste fixe." />
                <div role="region" aria-label="Sensibilité (défilable)" tabIndex={0} className="overflow-x-auto px-5 py-4">
                  <table className="w-full min-w-[520px] text-sm">
                    <caption className="sr-only">Cash-flow mensuel selon la variation du prix (lignes) et du loyer (colonnes)</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="pb-2 text-left text-xs font-medium text-ink-muted">Prix \ Loyer</th>
                        {SENSITIVITY_STEPS.map((s) => (
                          <th key={s} scope="col" className="pb-2 text-right text-xs font-medium text-ink-muted">
                            {step(s)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {grid.map((row, i) => (
                        <tr key={SENSITIVITY_STEPS[i]}>
                          <th scope="row" className="py-2 text-left text-xs font-medium text-ink-muted">
                            {step(SENSITIVITY_STEPS[i]!)}
                          </th>
                          {row.map((cell) => (
                            <td
                              key={cell.rentChange}
                              className={cn("tabular py-2 text-right", cell.priceChange === 0 && cell.rentChange === 0 && "font-semibold")}
                            >
                              <span className={cell.monthlyCashFlow >= 0 ? "text-success" : "text-danger"}>{fmt.signedEuros(cell.monthlyCashFlow)}</span>
                              <span className="block text-xs text-ink-muted">{fmt.percent(cell.netYield)}</span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <Badge tone="warning">Simulation</Badge>
            <span>
              Indicative et avant impôt : ce n&apos;est ni un conseil en investissement ni un conseil fiscal. Le notaire fixe les frais exacts, la
              banque les conditions du prêt.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
