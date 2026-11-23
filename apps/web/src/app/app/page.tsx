import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { requireAgency } from "@/lib/agency/context";
import { canManageTeam } from "@/lib/agency/rules";
import { getAgencySettings } from "@/lib/agency/settings";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/roles";
import { getAuth } from "@/lib/auth/server";
import { mandateAlert, mandateAlertLabel, utcToParisLocal } from "@immopilot/domain";
import { listAppointments } from "@/lib/agenda/data";
import { APPOINTMENT_KINDS } from "@/lib/agenda/labels";
import { listProperties, listTasks } from "@/lib/crm/data";
import { bucketTasks, todayAndTomorrowWindow } from "@/lib/dashboard/today";
import { listDeals } from "@/lib/deals/data";
import { dealDeadlines } from "@/lib/deals/deadlines";
import { fmt } from "@/lib/format";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/ui/surface";
import { RecapCard } from "./recap-card";

const timeFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

function DayList({ title, empty, href, items }: { title: string; empty: string; href: string; items: Array<{ key: string; label: string; meta: string; href: string; tone?: "danger" | "warning" | "brand" | "neutral" }> }) {
  return (
    <Card>
      <CardHeader title={title} action={<Link href={href} className="text-xs font-medium text-brand-text underline">Tout voir</Link>} />
      {items.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.slice(0, 8).map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-muted">
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{i.label}</span>
                <Badge tone={i.tone ?? "neutral"}>{i.meta}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export const metadata: Metadata = { title: "Accueil" };

// Feuille de route affichée telle quelle : ce sont des étapes prévues, pas des boutons.

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ recap?: string }> }) {
  const recapPeriod = (await searchParams).recap === "semaine" ? "semaine" : "jour";
  const ctx = await requireAgency();
  const { user, org, role } = ctx;
  const settings = await getAgencySettings(ctx);
  const full = await getAuth().api.getFullOrganization({ headers: await headers(), query: { organizationId: org.id } });
  const members = full?.members.length ?? 0;
  const pending = full?.invitations.filter((i) => i.status === "pending").length ?? 0;
  const manager = canManageTeam(role);

  // Ma journée : uniquement mes éléments (tâches, rendez-vous, affaires dont je suis en charge).
  const today = utcToParisLocal(new Date()).slice(0, 10);
  const range = todayAndTomorrowWindow(today);
  const [myTasks, myAppointments, deals, properties] = await Promise.all([
    listTasks(ctx, "mine"),
    listAppointments(ctx, { scope: "mine", from: range.from, to: range.to }),
    listDeals(ctx),
    listProperties(ctx),
  ]);
  const myMandates = properties
    .filter((p) => p.owner_user_id === user.id)
    .flatMap((p) => {
      const alert = mandateAlert({ status: p.status, mandateEndsOn: p.mandate_ends_on }, today);
      return alert ? [{ p, alert }] : [];
    });
  const buckets = bucketTasks(myTasks, today);
  const myDeadlines = deals
    .filter((d) => d.owner_user_id === user.id)
    .flatMap((d) => dealDeadlines(d, today).map((dl) => ({ d, dl })))
    .filter(({ dl }) => dl.daysLeft <= 7)
    .sort((a, b) => a.dl.date.localeCompare(b.dl.date));

  const steps = [
    { done: members > 1, label: "Inviter votre équipe", href: "/app/equipe", visible: manager },
    { done: settings.configured, label: "Choisir la visibilité par défaut des contacts et des biens", href: "/app/parametres", visible: manager },
  ].filter((s) => s.visible);

  return (
    <>
      <PageHeader
        title={
          <>
            Bonjour <span className="font-serif text-[1.12em] font-normal italic tracking-normal text-brand-text">{user.name.split(" ")[0]}</span>
          </>
        }
        description={`Espace de l'agence ${org.name}.`}
      />

      <RecapCard ctx={ctx} period={recapPeriod} />

      <section aria-label="Ma journée" className="mb-4 grid gap-4 lg:grid-cols-2">
        <DayList
          title={`Tâches en retard ou du jour (${buckets.overdue.length + buckets.today.length})`}
          empty="Rien en retard, rien pour aujourd'hui."
          href="/app/taches"
          items={[...buckets.overdue, ...buckets.today].map((t) => ({
            key: t.id,
            label: t.title,
            meta: t.due_on && t.due_on < today ? `En retard (${fmt.date(t.due_on)})` : "Aujourd'hui",
            href: t.property_id ? `/app/proprietes/${t.property_id}` : t.contact_id ? `/app/contacts/${t.contact_id}` : "/app/taches",
            tone: t.due_on && t.due_on < today ? "danger" : "warning",
          }))}
        />
        <DayList
          title={`Rendez-vous aujourd'hui et demain (${myAppointments.filter((a) => a.status === "prevu").length})`}
          empty="Aucun rendez-vous prévu aujourd'hui ni demain."
          href="/app/agenda"
          items={myAppointments
            .filter((a) => a.status === "prevu")
            .map((a) => ({ key: a.id, label: `${APPOINTMENT_KINDS[a.kind]} : ${a.title}`, meta: timeFmt.format(a.starts_at), href: "/app/agenda", tone: "brand" as const }))}
        />
        <DayList
          title={`Échéances de mes affaires à 7 jours (${myDeadlines.length})`}
          empty="Aucune échéance proche."
          href="/app/affaires"
          items={myDeadlines.map(({ d, dl }) => ({
            key: `${d.id}-${dl.key}`,
            label: `${dl.label} — ${d.property_label}`,
            meta: dl.daysLeft < 0 ? `Dépassée de ${-dl.daysLeft} j` : dl.daysLeft === 0 ? "Aujourd'hui" : `Dans ${dl.daysLeft} j`,
            href: `/app/affaires/${d.id}`,
            tone: dl.daysLeft < 0 ? "danger" : dl.daysLeft <= 3 ? "warning" : "neutral",
          }))}
        />
        {myMandates.length ? (
          <DayList
            title={`Mandats à renouveler (${myMandates.length})`}
            empty=""
            href="/app/proprietes"
            items={myMandates.map(({ p, alert }) => ({
              key: p.id,
              label: p.address_label,
              meta: mandateAlertLabel(alert),
              href: `/app/proprietes/${p.id}`,
              tone: alert.kind === "expire" ? "danger" : "warning",
            }))}
          />
        ) : null}
        <DayList
          title={`Biens signalés pour mes acquéreurs (${buckets.matches.length})`}
          empty="Aucun nouveau bien signalé."
          href="/app/taches"
          items={buckets.matches.map((t) => ({
            key: t.id,
            label: t.details ?? t.title,
            meta: /\((\d+) %\)/.exec(t.title)?.[1] ? `${/\((\d+) %\)/.exec(t.title)![1]} %` : "À voir",
            href: t.property_id ? `/app/proprietes/${t.property_id}` : "/app/taches",
            tone: "brand" as const,
          }))}
        />
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-[13px] text-ink-muted">Membres de l&apos;agence</p>
            <p className="tabular mt-1 text-3xl font-semibold tracking-tight text-ink">{members}</p>
            {pending > 0 ? <p className="mt-1 text-xs text-ink-muted">{pending} invitation(s) en attente</p> : null}
          </CardBody>
        </Card>
        <Card className="md:col-span-2">
          <CardBody>
            <div className="flex items-center gap-2">
              <p className="text-[13px] text-ink-muted">Votre rôle</p>
              <Badge tone="brand">{ROLE_LABELS[role]}</Badge>
            </div>
            <p className="mt-2 text-sm text-ink">{ROLE_DESCRIPTIONS[role]}</p>
          </CardBody>
        </Card>
      </div>

      {steps.length > 0 ? (
        <Card className="mt-4">
          <CardHeader title="Mise en route" description="Les premières étapes pour préparer l'espace de l'agence." />
          <ul className="divide-y divide-line">
            {steps.map((step) => (
              <li key={step.href}>
                <Link href={step.href} className="flex items-center gap-3 px-5 py-3.5 text-sm hover:bg-surface-muted">
                  <span
                    aria-hidden
                    className={step.done ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-[11px] text-white" : "size-5 shrink-0 rounded-full border-2 border-line-strong"}
                  >
                    {step.done ? "✓" : null}
                  </span>
                  <span className={step.done ? "text-ink-muted line-through" : "text-ink"}>{step.label}</span>
                  <span aria-hidden className="ml-auto text-ink-subtle">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

    </>
  );
}
