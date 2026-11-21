"use server";
/** Enregistrement d'un compte rendu de visite. La base applique les droits (migration 0018). */
import { withTenant } from "@immopilot/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "../agency/actions";
import { requireAgency } from "../agency/context";
import { audit } from "../audit";
import { getTenantPool } from "../server/db";

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max, `${max} caractères au maximum.`).nullable());

const schema = z.object({
  appointmentId: z.uuid("Visite introuvable."),
  interest: z.enum(["fort", "moyen", "faible", "aucun"], "Indiquez l'intérêt des visiteurs."),
  priceOpinion: z.preprocess((v) => (v === "" || v === null ? null : v), z.enum(["attractif", "coherent", "eleve", "trop_eleve"]).nullable()),
  nextStep: z.enum(["offre", "seconde_visite", "reflexion", "abandon"], "Indiquez la suite envisagée."),
  positives: optionalText(2000),
  objections: optionalText(2000),
});

export async function saveVisitReportAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") return { error: "Le rôle « lecture seule » ne permet pas de rédiger un compte rendu." };
  const parsed = schema.safeParse({
    appointmentId: form.get("appointmentId"), interest: form.get("interest") ?? undefined, priceOpinion: form.get("priceOpinion") ?? null,
    nextStep: form.get("nextStep") ?? undefined, positives: form.get("positives"), objections: form.get("objections"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  const d = parsed.data;

  const outcome = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) => {
    const visit = (await c.query<{ kind: string; status: string; property_id: string | null; started: boolean }>(
      "SELECT kind, status, property_id, starts_at <= now() AS started FROM app.appointments WHERE id = $1",
      [d.appointmentId],
    )).rows[0];
    if (!visit || visit.kind !== "visite") return { error: "Visite introuvable." };
    if (visit.status === "annule") return { error: "Cette visite a été annulée." };
    if (!visit.started) return { error: "La visite n'a pas encore eu lieu." };
    const values = [d.interest, d.priceOpinion, d.nextStep, d.positives, d.objections];
    const existing = (await c.query<{ id: string }>("SELECT id FROM app.visit_reports WHERE appointment_id = $1", [d.appointmentId])).rows[0];
    if (existing) {
      const updated = await c.query(
        `UPDATE app.visit_reports SET interest = $2, price_opinion = $3, next_step = $4, positives = $5, objections = $6, updated_at = now() WHERE id = $1`,
        [existing.id, ...values],
      );
      if (!updated.rowCount) return { error: "Seuls l'auteur du compte rendu, le gérant et les managers peuvent le modifier." };
      return { id: existing.id };
    }
    const inserted = await c.query<{ id: string }>(
      `INSERT INTO app.visit_reports (org_id, appointment_id, property_id, author_user_id, interest, price_opinion, next_step, positives, objections)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [ctx.org.id, d.appointmentId, visit.property_id, ctx.user.id, ...values],
    );
    return { id: inserted.rows[0]!.id };
  }).catch((e: unknown) => {
    if ((e as { code?: string }).code === "42501") return { error: "Vous ne pouvez pas rédiger le compte rendu de cette visite." };
    throw e;
  });
  if ("error" in outcome) return { error: outcome.error };

  // Journal sans donnée personnelle : identifiants seulement.
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "visite.compte_rendu", targetType: "rdv", targetId: d.appointmentId });
  revalidatePath(`/app/agenda/${d.appointmentId}/compte-rendu`);
  revalidatePath("/app/agenda");
  return { success: "Compte rendu enregistré." };
}
