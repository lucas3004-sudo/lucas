/**
 * Récap de l'activité (D-062), en tête de l'accueil : ce qui s'est passé dans l'agence sur
 * 24 heures ou 7 jours, et ce qui demande une action. Chaque ligne mène à la page concernée.
 */
import { RECAP_PERIOD_LABELS, recapHeadline, recapLines, type RecapPeriod } from "@immopilot/domain";
import { aiConfig } from "@/lib/ai/config";
import { AiRecap } from "./ai-recap";
import Link from "next/link";
import type { AgencyContext } from "@/lib/agency/context";
import { fmt } from "@/lib/format";
import { recapData } from "@/lib/recap/data";
import { cn } from "@/ui/cn";

const DOT = { success: "bg-success", brand: "bg-brand", warning: "bg-warning", neutral: "bg-ink-subtle" } as const;

export async function RecapCard({ ctx, period }: { ctx: AgencyContext; period: RecapPeriod }) {
  const { counts, priceDrops } = await recapData(ctx, period);
  const lines = recapLines(counts);
  return (
    <section aria-labelledby="recap" className="mb-5 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 id="recap" className="font-display text-[16px] font-semibold tracking-[-0.02em] text-ink">Le récap</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted" data-testid="recap-titre">{recapHeadline(counts, period)}</p>
        </div>
        <nav aria-label="Période du récap" className="flex gap-1 rounded-full bg-surface-muted p-1">
          {(Object.keys(RECAP_PERIOD_LABELS) as RecapPeriod[]).map((p) => (
            <Link
              key={p}
              href={p === "jour" ? "/app" : `/app?recap=${p}`}
              aria-current={p === period ? "page" : undefined}
              scroll={false}
              className={cn(
                "rounded-full px-3 py-1 text-[13px] transition-colors duration-200",
                p === period ? "bg-surface font-medium text-ink shadow-[var(--shadow-card)]" : "text-ink-muted hover:text-ink",
              )}
            >
              {RECAP_PERIOD_LABELS[p]}
            </Link>
          ))}
        </nav>
      </div>
      {lines.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-muted">Rien de nouveau sur la période. Les nouveaux biens, contacts, visites et offres apparaîtront ici.</p>
      ) : (
        <ul className="grid gap-x-6 px-5 py-3 sm:grid-cols-2" data-testid="recap">
          {lines.map((l) => (
            <li key={l.key}>
              <Link href={l.href} className="group flex items-center gap-2.5 rounded-xl py-1.5 text-sm text-ink">
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[l.tone])} />
                <span className="group-hover:underline">{l.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {priceDrops.length ? (
        <div className="border-t border-line px-5 py-3">
          <p className="text-xs font-medium text-ink-muted">Baisses de prix</p>
          <ul className="mt-1.5 space-y-1">
            {priceDrops.map((d) => (
              <li key={`${d.propertyId}-${d.to}`} className="flex flex-wrap justify-between gap-2 text-sm">
                <Link href={`/app/proprietes/${d.propertyId}/fiche`} className="truncate text-ink hover:underline">{d.label}</Link>
                <span className="tabular text-ink-muted">
                  {fmt.euros(d.from)} → <span className="font-medium text-ink">{fmt.euros(d.to)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {aiConfig().enabled && lines.length ? <AiRecap period={period} /> : null}
    </section>
  );
}
