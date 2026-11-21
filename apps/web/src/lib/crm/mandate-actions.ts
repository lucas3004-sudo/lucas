"use server";
/**
 * Suivi du mandat d'un bien (migration 0019) : type, numéro, dates. La base applique les droits
 * de modification du bien (responsable, gérant, managers) et l'unicité du numéro dans l'agence.
 */
import { withTenant } from "@immopilot/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAgency } from "../agency/context";
import { audit } from "../audit";
import { getTenantPool } from "../server/db";
import type { CrmState } from "./actions";

const blank = (v: unknown) => v === "" || v === null || v === undefined;
const optionalDate = z.preprocess((v) => (blank(v) ? null : v), z.iso.date("Date invalide.").nullable());

const schema = z
  .object({
    id: z.uuid(),
    mandateType: z.preprocess((v) => (blank(v) ? null : v), z.enum(["simple", "exclusif"]).nullable()),
    mandateNumber: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(30, "Numéro trop long (30 caractères au plus).").nullable()),
    signedOn: optionalDate,
    endsOn: optionalDate,
  })
  .refine((d) => !d.signedOn || !d.endsOn || d.endsOn > d.signedOn, { message: "La date de fin doit suivre la date de signature." });

export async function updateMandateAction(_prev: CrmState, form: FormData): Promise<CrmState> {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") return { error: "Le rôle « lecture seule » ne permet pas de modifier un mandat." };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  const d = parsed.data;
  try {
    const updated = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, (_db, c) =>
      c.query(
        `UPDATE app.properties SET mandate_type = $2, mandate_number = $3, mandate_signed_on = $4, mandate_ends_on = $5, updated_at = now() WHERE id = $1`,
        [d.id, d.mandateType, d.mandateNumber, d.signedOn, d.endsOn],
      ));
    if (!updated.rowCount) return { error: "Seuls le responsable du bien, le gérant et les managers peuvent modifier son mandat." };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "23505") return { error: "Ce numéro de mandat est déjà utilisé dans l'agence." };
    if (code === "23514") return { error: "La date de fin doit suivre la date de signature." };
    throw e;
  }
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "bien_agence.mandat", targetType: "bien", targetId: d.id });
  revalidatePath(`/app/proprietes/${d.id}`);
  return { success: "Mandat enregistré." };
}
