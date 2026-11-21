/**
 * Export calendrier (.ics) : un rendez-vous (?rdv=<id>) ou tous MES rendez-vous des 30 derniers
 * jours et à venir. Les annulés sont exportés « annulés » pour que l'agenda les retire.
 */
import { buildIcs } from "@immopilot/domain";
import { z } from "zod";
import { requireAgency } from "@/lib/agency/context";
import { listAppointments } from "@/lib/agenda/data";
import { APPOINTMENT_KINDS } from "@/lib/agenda/labels";

export async function GET(request: Request) {
  const ctx = await requireAgency();
  const rdv = z.uuid().safeParse(new URL(request.url).searchParams.get("rdv"));
  const appointments = rdv.success
    ? await listAppointments(ctx, { id: rdv.data })
    : await listAppointments(ctx, { scope: "mine", from: new Date(Date.now() - 30 * 86_400_000), limit: 1000 });
  if (rdv.success && appointments.length === 0) {
    return new Response(JSON.stringify({ type: "about:blank", title: "Rendez-vous introuvable", status: 404 }), {
      status: 404,
      headers: { "content-type": "application/problem+json" },
    });
  }
  const ics = buildIcs(
    appointments.map((a) => ({
      uid: `${a.id}@immopilot`,
      start: a.starts_at,
      end: a.ends_at,
      summary: `${APPOINTMENT_KINDS[a.kind]} : ${a.title}`,
      location: a.location,
      description: [a.contact_name ? `Contact : ${a.contact_name}` : null, a.notes].filter(Boolean).join("\n") || null,
      cancelled: a.status === "annule",
      updatedAt: a.updated_at,
    })),
    { calendarName: `ImmoPilot — ${ctx.org.name}` },
  );
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${rdv.success ? "rendez-vous" : "mes-rendez-vous"}.ics"`,
      "cache-control": "no-store",
    },
  });
}
