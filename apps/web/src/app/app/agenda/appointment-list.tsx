import Link from "next/link";
import { setAppointmentStatusAction } from "@/lib/agenda/actions";
import type { Appointment } from "@/lib/agenda/data";
import { APPOINTMENT_KINDS } from "@/lib/agenda/labels";
import { buttonClass } from "@/ui/button";
import { SubmitButton } from "@/ui/client";
import { Badge } from "@/ui/surface";
import { memberName, type Member } from "../_crm/parts";

const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export function AppointmentList({
  appointments,
  members,
  meId,
  canManage,
}: {
  appointments: Appointment[];
  members: Member[];
  meId: string;
  /** Peut annuler ou rétablir (organisateur, auteur, gérant, manager, assistant). */
  canManage: (a: Appointment) => boolean;
}) {
  const now = Date.now();
  const days = new Map<string, Appointment[]>();
  for (const a of appointments) {
    const day = dayFmt.format(a.starts_at);
    days.set(day, [...(days.get(day) ?? []), a]);
  }
  return (
    <div className="divide-y divide-line">
      {[...days.entries()].map(([day, items]) => (
        <section key={day} aria-label={day}>
          <h3 className="bg-surface-muted px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted first-letter:uppercase">{day}</h3>
          <ul className="divide-y divide-line">
            {items.map((a) => {
              const cancelled = a.status === "annule";
              return (
                <li key={a.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
                  <span className="tabular w-24 shrink-0 text-sm font-medium text-ink">
                    {timeFmt.format(a.starts_at)} – {timeFmt.format(a.ends_at)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cancelled ? "text-sm text-ink-muted line-through" : "text-sm font-medium text-ink"}>
                      {APPOINTMENT_KINDS[a.kind]} : {a.title}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {a.organizer_user_id === meId ? "Moi" : memberName(members, a.organizer_user_id)}
                      {a.location ? ` · ${a.location}` : ""}
                      {a.contact_id && a.contact_name ? (
                        <>
                          {" · "}
                          <Link href={`/app/contacts/${a.contact_id}`} className="underline">{a.contact_name}</Link>
                        </>
                      ) : null}
                      {a.property_id && a.property_label ? (
                        <>
                          {" · "}
                          <Link href={`/app/proprietes/${a.property_id}`} className="underline">bien</Link>
                        </>
                      ) : null}
                    </p>
                    {a.notes ? <p className="mt-1 whitespace-pre-line text-[13px] text-ink-muted">{a.notes}</p> : null}
                  </div>
                  {cancelled ? <Badge tone="danger">Annulé</Badge> : null}
                  <a
                    href={`/api/v1/agenda/ics?rdv=${a.id}`}
                    download
                    className={buttonClass("ghost", "sm")}
                    title="Ajouter à mon agenda (Google, Outlook, Apple)"
                    aria-label={`Ajouter « ${a.title} » à mon agenda (.ics)`}
                  >
                    .ics
                  </a>
                  {a.kind === "visite" && !cancelled && a.starts_at.getTime() <= now ? (
                    <Link
                      href={`/app/agenda/${a.id}/compte-rendu`}
                      className={buttonClass(a.has_report ? "ghost" : "secondary", "sm")}
                      aria-label={`${a.has_report ? "Voir le compte rendu" : "Rédiger le compte rendu"} de « ${a.title} »`}
                    >
                      {a.has_report ? "Compte rendu" : "Rédiger le compte rendu"}
                    </Link>
                  ) : null}
                  {canManage(a) ? (
                    <form action={setAppointmentStatusAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="status" value={cancelled ? "prevu" : "annule"} />
                      <SubmitButton variant="secondary" size="sm">
                        {cancelled ? "Rétablir" : "Annuler"}
                      </SubmitButton>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
