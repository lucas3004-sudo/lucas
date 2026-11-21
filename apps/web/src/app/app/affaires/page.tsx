import { utcToParisLocal } from "@immopilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/agency/context";
import { agencyMembers } from "@/lib/crm/data";
import { listDeals } from "@/lib/deals/data";
import { dealDeadlines } from "@/lib/deals/deadlines";
import { ACTIVE_STAGES, DEAL_STAGES } from "@/lib/deals/labels";
import { fmt } from "@/lib/format";
import { LinkButton } from "@/ui/button";
import { Badge, Card, CardHeader, PageHeader } from "@/ui/surface";
import { EmptyState, memberName } from "../_crm/parts";

export const metadata: Metadata = { title: "Affaires" };

export default async function DealsPage() {
  const ctx = await requireAgency();
  const [deals, members] = await Promise.all([listDeals(ctx), agencyMembers(ctx.org.id)]);
  const today = utcToParisLocal(new Date()).slice(0, 10);
  const upcoming = deals
    .flatMap((d) => dealDeadlines(d, today).map((dl) => ({ deal: d, dl })))
    .filter(({ dl }) => dl.daysLeft <= 14)
    .sort((a, b) => a.dl.date.localeCompare(b.dl.date));
  const closed = deals.filter((d) => d.stage === "acte" || d.stage === "abandon").slice(0, 20);

  return (
    <>
      <PageHeader
        title="Affaires"
        description="Suivi des ventes de l'offre acceptée à l'acte authentique : étapes, échéances et pièces. Les dates calculées sont indicatives : le notaire fait foi."
        actions={ctx.role !== "lecture" ? <LinkButton href="/app/affaires/nouvelle">Nouvelle affaire</LinkButton> : null}
      />

      <Card className="mb-4">
        <CardHeader title={`Échéances des 14 prochains jours (${upcoming.length})`} description="Y compris les échéances dépassées des affaires en cours." />
        {upcoming.length === 0 ? (
          <EmptyState title="Aucune échéance proche." />
        ) : (
          <ul className="divide-y divide-line">
            {upcoming.map(({ deal, dl }) => (
              <li key={`${deal.id}-${dl.key}`}>
                <Link href={`/app/affaires/${deal.id}`} className="flex flex-wrap items-center gap-3 px-5 py-2.5 hover:bg-surface-muted">
                  <Badge tone={dl.daysLeft < 0 ? "danger" : dl.daysLeft <= 3 ? "warning" : "brand"}>
                    {dl.daysLeft < 0 ? `Dépassée de ${-dl.daysLeft} j` : dl.daysLeft === 0 ? "Aujourd'hui" : `Dans ${dl.daysLeft} j`}
                  </Badge>
                  <span className="text-sm text-ink">{dl.label} : {fmt.date(dl.date)}</span>
                  <span className="min-w-0 flex-1 truncate text-right text-xs text-ink-muted">{deal.property_label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {ACTIVE_STAGES.map((stage) => {
          const items = deals.filter((d) => d.stage === stage);
          return (
            <Card key={stage}>
              <CardHeader title={`${DEAL_STAGES[stage]} (${items.length})`} />
              {items.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-muted">Aucune affaire.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {items.map((d) => (
                    <li key={d.id}>
                      <Link href={`/app/affaires/${d.id}`} className="block px-5 py-3 hover:bg-surface-muted">
                        <p className="truncate text-sm font-medium text-ink">{d.property_label}</p>
                        <p className="text-xs text-ink-muted">
                          {d.price !== null ? `${fmt.euros(d.price)} · ` : ""}
                          {memberName(members, d.owner_user_id)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      {closed.length ? (
        <Card className="mt-4">
          <CardHeader title="Affaires terminées" description="Les 20 plus récentes." />
          <ul className="divide-y divide-line">
            {closed.map((d) => (
              <li key={d.id}>
                <Link href={`/app/affaires/${d.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-muted">
                  <Badge tone={d.stage === "acte" ? "success" : "neutral"}>{DEAL_STAGES[d.stage]}</Badge>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{d.property_label}</span>
                  {d.deed_signed_on ? <span className="text-xs text-ink-muted">{fmt.date(d.deed_signed_on)}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
