"use server";
/** Actions de l'agenda : création et annulation. La base applique les droits (RLS, migration 0009). */
import { withTenant } from "@immopilot/db";
import { parisLocalToUtc } from "@immopilot/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAgency } from "../agency/context";
import { audit } from "../audit";
import type { CrmState } from "../crm/actions";
import { getTenantPool } from "../server/db";
import { DURATIONS_MIN } from "./labels";

const UUID = z.uuid();
const optionalUuid = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), UUID.nullable());
const optionalText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable());

const schema = z.object({
  title: z.string().trim().min(2, "Titre trop court.").max(200),
  kind: z.enum(["visite", "estimation", "signature", "rendez_vous", "autre"]),
  start: z.string(),
  duration: z.coerce.number().refine((d) => (DURATIONS_MIN as readonly number[]).includes(d), "Durée invalide."),
  location: optionalText(300),
  notes: optionalText(2000),
  contactId: optionalUuid,
  propertyId: optionalUuid,
  organizerUserId: UUID,
});

export async function createAppointmentAction(_prev: CrmState, form: FormData): Promise<CrmState> {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") return { error: "Le rôle « lecture seule » ne permet pas de planifier un rendez-vous." };
  const assign = ctx.role === "gerant" || ctx.role === "manager" || ctx.role === "assistant";
  const parsed = schema.safeParse({
    title: form.get("title"), kind: form.get("kind"), start: form.get("start") ?? "", duration: form.get("duration"),
    location: form.get("location"), notes: form.get("notes"), contactId: form.get("contactId"), propertyId: form.get("propertyId"),
    organizerUserId: assign ? form.get("organizerUserId") || ctx.user.id : ctx.user.id,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  const d = parsed.data;
  const start = parisLocalToUtc(d.start);
  if (!start) return { error: "Date ou heure invalide (attention aux changements d'heure)." };
  const now = Date.now();
  if (start.getTime() < now - 30 * 86_400_000 || start.getTime() > now + 2 * 365 * 86_400_000) {
    return { error: "La date doit être comprise entre il y a 30 jours et dans 2 ans." };
  }
  const end = new Date(start.getTime() + d.duration * 60_000);

  let id: string | null = null;
  try {
    id = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) => {
      // Le contact et le bien liés doivent être visibles par l'auteur (RLS).
      if (d.contactId && !(await c.query("SELECT 1 FROM app.contacts WHERE id = $1", [d.contactId])).rowCount) return null;
      let location = d.location;
      if (d.propertyId) {
        const p = (await c.query<{ address_label: string }>("SELECT address_label FROM app.properties WHERE id = $1", [d.propertyId])).rows[0];
        if (!p) return null;
        location ??= p.address_label;
      }
      return (await c.query<{ id: string }>(
        `INSERT INTO app.appointments (org_id, organizer_user_id, created_by, kind, title, starts_at, ends_at, location, notes, contact_id, property_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [ctx.org.id, d.organizerUserId, ctx.user.id, d.kind, d.title, start, end, location, d.notes, d.contactId, d.propertyId],
      )).rows[0]!.id;
    });
  } catch (e) {
    if ((e as { code?: string }).code === "42501") return { error: "Vous ne pouvez pas planifier ce rendez-vous pour ce membre." };
    throw e;
  }
  if (!id) return { error: "Contact ou bien introuvable." };
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "rdv.cree", targetType: "rdv", targetId: id });
  revalidatePath("/app/agenda");
  if (d.contactId) revalidatePath(`/app/contacts/${d.contactId}`);
  return { success: "Rendez-vous enregistré." };
}

export async function setAppointmentStatusAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  const id = UUID.parse(form.get("id"));
  const status = z.enum(["prevu", "annule"]).parse(form.get("status"));
  const updated = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    (await c.query("UPDATE app.appointments SET status = $2, updated_at = now() WHERE id = $1", [id, status])).rowCount ?? 0);
  if (updated && status === "annule") await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "rdv.annule", targetType: "rdv", targetId: id });
  revalidatePath("/app/agenda");
}
