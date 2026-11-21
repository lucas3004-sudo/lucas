import { utcToParisLocal } from "@immopilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/agency/context";
import { listAppointments } from "@/lib/agenda/data";
import { APPOINTMENT_KINDS } from "@/lib/agenda/labels";
import { agencyMembers, contactName, listContacts, listProperties } from "@/lib/crm/data";
import { visitsWithoutReport } from "@/lib/visits/data";
import { buttonClass } from "@/ui/button";
import { cn } from "@/ui/cn";
import { Card, CardHeader, PageHeader } from "@/ui/surface";
import { EmptyState } from "../_crm/parts";
import { AppointmentForm } from "./appointment-form";
import { AppointmentList } from "./appointment-list";

export const metadata: Metadata = { title: "Agenda" };

type Search = { vue?: string; contact?: string; bien?: string; type?: string };
const UUID_RE = /^[0-9a-f-]{36}$/i;
const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });

export default async function AgendaPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireAgency();
  const s = await searchParams;
  const seesTeam = ctx.role === "gerant" || ctx.role === "manager";
  const scope = s.vue === "equipe" && seesTeam ? "team" : "mine";
  const canAssign = seesTeam || ctx.role === "assistant";
  const [appointments, members, contacts, properties, toReport] = await Promise.all([
    listAppointments(ctx, { scope, from: new Date(Date.now() - 86_400_000) }),
    agencyMembers(ctx.org.id),
    ctx.role !== "lecture" ? listContacts(ctx) : Promise.resolve([]),
    ctx.role !== "lecture" ? listProperties(ctx) : Promise.resolve([]),
    ctx.role !== "lecture" ? visitsWithoutReport(ctx) : Promise.resolve([]),
  ]);
  // Proposition de créneau : demain à 10 h (heure de Paris).
  const tomorrow = utcToParisLocal(new Date(Date.now() + 86_400_000)).slice(0, 10);
  const defaults = {
    kind: s.type && s.type in APPOINTMENT_KINDS ? s.type : "visite",
    contactId: s.contact && UUID_RE.test(s.contact) ? s.contact : "",
    propertyId: s.bien && UUID_RE.test(s.bien) ? s.bien : "",
    start: `${tomorrow}T10:00`,
  };
  const tab = (active: boolean) =>
    cn("rounded-[var(--radius-control)] px-3 py-1.5 text-sm", active ? "bg-brand-soft font-medium text-brand-text" : "text-ink-muted hover:bg-surface-muted");
  const canManage = (a: { organizer_user_id: string; created_by: string }) =>
    a.organizer_user_id === ctx.user.id || a.created_by === ctx.user.id || canAssign;

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Visites, estimations et signatures. Chaque rendez-vous s'ajoute à votre agenda habituel (Google, Outlook, Apple) par un fichier .ics."
        actions={
          <a href="/api/v1/agenda/ics" download className={buttonClass("secondary")}>
            Exporter mes rendez-vous (.ics)
          </a>
        }
      />
      {ctx.role !== "lecture" ? (
        <Card className="mb-4">
          <CardHeader title="Nouveau rendez-vous" />
          <AppointmentForm
            members={members}
            meId={ctx.user.id}
            canAssign={canAssign}
            contacts={contacts.map((c) => ({ id: c.id, label: contactName(c) }))}
            properties={properties.map((p) => ({ id: p.id, label: p.address_label }))}
            defaults={defaults}
          />
        </Card>
      ) : null}
      {toReport.length ? (
        <Card className="mb-4">
          <CardHeader
            title={`Visites sans compte rendu (${toReport.length})`}
            description="Vos visites des 30 derniers jours. Le compte rendu produit un texte prêt à envoyer au vendeur."
          />
          <ul className="divide-y divide-line">
            {toReport.map((v) => (
              <li key={v.id}>
                <Link href={`/app/agenda/${v.id}/compte-rendu`} className="flex flex-wrap items-center gap-x-3 px-5 py-2.5 hover:bg-surface-muted">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{v.title}{v.property_label ? ` · ${v.property_label}` : ""}</span>
                  <span className="text-xs text-ink-muted">{dayFmt.format(v.starts_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {seesTeam ? (
        <nav aria-label="Filtre de l'agenda" className="mb-3 flex gap-1">
          <Link href="/app/agenda" className={tab(scope === "mine")} aria-current={scope === "mine" ? "page" : undefined}>Mes rendez-vous</Link>
          <Link href="/app/agenda?vue=equipe" className={tab(scope === "team")} aria-current={scope === "team" ? "page" : undefined}>Toute l&apos;équipe</Link>
        </nav>
      ) : null}
      <Card>
        <CardHeader title="À venir" description="Depuis hier, dans l'ordre chronologique." />
        {appointments.length ? (
          <AppointmentList appointments={appointments} members={members} meId={ctx.user.id} canManage={canManage} />
        ) : (
          <EmptyState title="Aucun rendez-vous à venir." />
        )}
      </Card>
    </>
  );
}
