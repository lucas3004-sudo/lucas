import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/agency/context";
import { canReadAuditLog } from "@/lib/agency/rules";
import { activeProfiles, agencyMembers, asMatchProfile, asMatchProperty, matchableProperties } from "@/lib/crm/data";
import { PROPERTY_STATUS, type PropertyStatus } from "@/lib/crm/labels";
import { fmt } from "@/lib/format";
import { ACTIVITY_COLUMNS, loadPilotage, parsePeriod, PERIODS } from "@/lib/pilotage/data";
import { MATCH_THRESHOLD, propertiesWithoutBuyer } from "@/lib/pilotage/unmatched";
import { cn } from "@/ui/cn";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/ui/surface";
import { EmptyState, memberName } from "../_crm/parts";

export const metadata: Metadata = { title: "Pilotage de l'agence" };

export default async function PilotagePage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const ctx = await requireAgency();
  if (!canReadAuditLog(ctx.role)) {
    return (
      <>
        <PageHeader title="Pilotage de l'agence" />
        <Alert tone="warning">Le tableau de bord de l&apos;agence est réservé au gérant et aux managers.</Alert>
      </>
    );
  }

  const days = parsePeriod((await searchParams).periode);
  const [data, members, properties, profiles] = await Promise.all([
    loadPilotage(ctx, days),
    agencyMembers(ctx.org.id),
    matchableProperties(ctx),
    activeProfiles(ctx),
  ]);
  // Ordre alphabétique : aucun classement des personnes (F13).
  const team = [...members].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const formerIds = [...data.activity.keys()].filter((id) => !members.some((m) => m.userId === id));
  const uncovered = propertiesWithoutBuyer(properties, profiles.map(asMatchProfile), asMatchProperty);
  const period = `du ${fmt.date(data.from)} au ${fmt.date(data.to)}`;
  const tab = (active: boolean) =>
    cn("rounded-[var(--radius-control)] px-3 py-1.5 text-sm", active ? "bg-brand-soft font-medium text-brand-text" : "text-ink-muted hover:bg-surface-muted");

  return (
    <>
      <PageHeader
        title="Pilotage de l'agence"
        description="Chiffres mesurés uniquement, chacun avec sa période. Les membres sont listés par ordre alphabétique : aucun classement."
      />

      <nav aria-label="Période" className="mb-4 flex gap-1">
        {PERIODS.map((p) => (
          <Link key={p} href={`/app/pilotage?periode=${p}`} className={tab(p === days)} aria-current={p === days ? "page" : undefined}>
            {p} jours
          </Link>
        ))}
      </nav>

      <Card className="mb-4">
        <CardHeader title="Activité de l'équipe" description={`Période ${period}. Source : journal d'audit (les éléments supprimés depuis restent comptés), agenda (rendez-vous non annulés, déjà passés), affaires (actes signés) et tâches.`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th scope="col" className="px-5 py-2.5 font-medium">Membre</th>
                {ACTIVITY_COLUMNS.map((col) => (
                  <th key={col.key} scope="col" className="px-3 py-2.5 text-right font-medium">{col.label}</th>
                ))}
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Rendez-vous passés</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Actes signés</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Tâches terminées</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">En retard aujourd&apos;hui</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...team.map((m) => ({ id: m.userId, name: m.name })), ...formerIds.map((id) => ({ id, name: "Ancien membre" }))].map((m) => {
                const a = data.activity.get(m.id);
                return (
                  <tr key={m.id}>
                    <th scope="row" className="px-5 py-2.5 text-left font-medium text-ink">{m.name}</th>
                    {ACTIVITY_COLUMNS.map((col) => (
                      <td key={col.key} className="tabular px-3 py-2.5 text-right text-ink">{a?.counts[col.key] ?? 0}</td>
                    ))}
                    <td className="tabular px-3 py-2.5 text-right text-ink">{a?.appointments ?? 0}</td>
                    <td className="tabular px-3 py-2.5 text-right text-ink">{a?.deedsSigned ?? 0}</td>
                    <td className="tabular px-3 py-2.5 text-right text-ink">{a?.tasksDone ?? 0}</td>
                    <td className={cn("tabular px-5 py-2.5 text-right", a?.tasksOverdue ? "font-medium text-danger" : "text-ink")}>{a?.tasksOverdue ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Portefeuille de biens" description={`État au ${fmt.date(data.to)} (tous les biens, y compris privés).`} />
          <ul className="divide-y divide-line">
            {(Object.keys(PROPERTY_STATUS) as PropertyStatus[]).map((s) => (
              <li key={s} className="flex justify-between px-5 py-2.5 text-sm">
                <span className="text-ink">{PROPERTY_STATUS[s]}</span>
                <span className="tabular font-medium text-ink">{data.pipeline[s] ?? 0}</span>
              </li>
            ))}
            <li className="flex justify-between px-5 py-2.5 text-sm">
              <span className="text-ink-muted">dont mandats exclusifs (sous mandat ou sous offre)</span>
              <span className="tabular text-ink">{data.exclusiveMandates}</span>
            </li>
          </ul>
        </Card>

        <Card>
          <CardHeader
            title={`Biens sans acquéreur correspondant (${uncovered.length})`}
            description={`Biens proposés dont aucun profil de recherche actif n'atteint ${MATCH_THRESHOLD} % (pondérations par défaut). État au ${fmt.date(data.to)}.`}
          />
          {uncovered.length === 0 ? (
            <EmptyState title="Chaque bien proposé a au moins un acquéreur correspondant." />
          ) : (
            <ul className="divide-y divide-line">
              {uncovered.slice(0, 20).map(({ property, bestScore }) => (
                <li key={property.id}>
                  <Link href={`/app/proprietes/${property.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-muted">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{property.address_label}</span>
                      <span className="text-xs text-ink-muted">{memberName(members, property.owner_user_id)}</span>
                    </span>
                    <Badge tone={bestScore === null ? "neutral" : "warning"}>{bestScore === null ? "Aucun profil compatible" : `Meilleur : ${bestScore} %`}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title={`Relances en retard (${data.overdueTotal})`} description={`Tâches à faire dont l'échéance est dépassée au ${fmt.date(data.to)}.`} />
        {data.overdue.length === 0 ? (
          <EmptyState title="Aucune tâche en retard." />
        ) : (
          <ul className="divide-y divide-line">
            {data.overdue.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                <span className="min-w-0 flex-1 text-ink">{t.title}</span>
                <span className="text-xs text-ink-muted">{memberName(members, t.assignee_user_id)}</span>
                <Badge tone="danger">Échéance {fmt.date(t.due_on)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
