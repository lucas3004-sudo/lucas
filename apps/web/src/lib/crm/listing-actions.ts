"use server";
/** Enregistrement des champs d'annonce d'un bien (la base applique les droits de modification du bien). */
import { withTenant } from "@immopilot/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAgency } from "../agency/context";
import type { CrmState } from "./actions";
import { getTenantPool } from "../server/db";

const blank = (v: unknown) => v === "" || v === null || v === undefined;
const optionalInt = (min: number, max: number) => z.preprocess((v) => (blank(v) ? null : v), z.coerce.number().int().min(min).max(max).nullable());
const optionalClass = z.preprocess((v) => (blank(v) ? null : v), z.enum(["A", "B", "C", "D", "E", "F", "G"]).nullable());
const optionalText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable());

const schema = z
  .object({
    id: z.uuid(),
    dpeClass: optionalClass,
    gesClass: optionalClass,
    energyCostLow: optionalInt(0, 100_000),
    energyCostHigh: optionalInt(0, 100_000),
    energyCostYear: optionalInt(2015, 2100),
    isCopro: z.preprocess((v) => (v === "oui" ? true : v === "non" ? false : null), z.boolean().nullable()),
    coproLots: optionalInt(1, 100_000),
    coproAnnualCharges: optionalInt(0, 1_000_000),
    coproProcedure: optionalText(500),
    feesPayer: z.preprocess((v) => (blank(v) ? null : v), z.enum(["vendeur", "acquereur"]).nullable()),
    feesPercent: z.preprocess((v) => (blank(v) ? null : typeof v === "string" ? v.replace(",", ".") : v), z.coerce.number().min(0).max(30).nullable()),
    title: optionalText(120),
    description: optionalText(4000),
  })
  .refine((d) => d.energyCostLow === null || d.energyCostHigh === null || d.energyCostLow <= d.energyCostHigh, {
    message: "La fourchette basse des dépenses d'énergie dépasse la fourchette haute.",
  });

export async function updateListingAction(_prev: CrmState, form: FormData): Promise<CrmState> {
  const ctx = await requireAgency();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  const d = parsed.data;
  const updated = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    (await c.query(
      `UPDATE app.properties SET dpe_class = $2, ges_class = $3, energy_cost_low = $4, energy_cost_high = $5, energy_cost_year = $6,
         is_copro = $7, copro_lots = $8, copro_annual_charges = $9, copro_procedure = $10, fees_payer = $11, fees_percent = $12,
         listing_title = $13, listing_description = $14, updated_at = now()
       WHERE id = $1`,
      [d.id, d.dpeClass, d.gesClass, d.energyCostLow, d.energyCostHigh, d.energyCostYear, d.isCopro,
       d.isCopro ? d.coproLots : null, d.isCopro ? d.coproAnnualCharges : null, d.isCopro ? d.coproProcedure : null,
       d.feesPayer, d.feesPayer === "acquereur" ? d.feesPercent : null, d.title, d.description],
    )).rowCount ?? 0);
  if (!updated) return { error: "Seul le responsable du bien (ou le gérant, un manager, un assistant) peut modifier son annonce." };
  revalidatePath(`/app/proprietes/${d.id}/annonce`);
  return { success: "Annonce enregistrée. Le contrôle des mentions est à jour." };
}
