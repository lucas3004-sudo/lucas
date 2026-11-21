"use server";
/**
 * Actions des affaires. La base applique les droits (migration 0010). Le statut du bien suit
 * l'étape de l'affaire quand l'utilisateur a le droit de modifier le bien (sinon il reste tel quel).
 */
import { withTenant } from "@immopilot/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type pg from "pg";
import { z } from "zod";
import { requireAgency, type AgencyContext } from "../agency/context";
import { audit } from "../audit";
import type { CrmState } from "../crm/actions";
import { getTenantPool } from "../server/db";
import { CHECKLIST_KEYS, type DealStage } from "./labels";

const UUID = z.uuid();
const optionalUuid = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), UUID.nullable());
const optionalDate = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.iso.date("Date invalide.").nullable());
const optionalAmount = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.number().int("Montant en euros entiers.").min(0).max(100_000_000).nullable(),
);
const tenant = (ctx: AgencyContext) => ({ orgId: ctx.org.id, userId: ctx.user.id });
const assigns = (ctx: AgencyContext) => ctx.role === "gerant" || ctx.role === "manager" || ctx.role === "assistant";

/** Statut du bien selon l'étape (null : inchangé). */
const PROPERTY_STATUS_FOR: Record<DealStage, string | null> = {
  offre: "sous_offre",
  compromis: "sous_offre",
  conditions_levees: "sous_offre",
  acte: "vendu",
  abandon: null,
};

async function syncPropertyStatus(c: pg.PoolClient, dealId: string, stage: DealStage) {
  const status = PROPERTY_STATUS_FOR[stage];
  if (status) {
    await c.query(
      `UPDATE app.properties SET status = $2, updated_at = now() WHERE id = (SELECT property_id FROM app.deals WHERE id = $1) AND status <> $2`,
      [dealId, status],
    );
  } else {
    // Abandon : un bien « sous offre » redevient « sous mandat » s'il n'a pas d'autre affaire en cours.
    await c.query(
      `UPDATE app.properties p SET status = 'mandat', updated_at = now()
       WHERE p.id = (SELECT property_id FROM app.deals WHERE id = $1) AND p.status = 'sous_offre'
         AND NOT EXISTS (SELECT 1 FROM app.deals o WHERE o.property_id = p.id AND o.id <> $1 AND o.stage IN ('offre', 'compromis', 'conditions_levees'))`,
      [dealId],
    );
  }
}

const createSchema = z.object({
  propertyId: UUID,
  buyerContactId: optionalUuid,
  sellerContactId: optionalUuid,
  price: optionalAmount,
  fees: optionalAmount,
  offerAcceptedOn: optionalDate,
  ownerUserId: UUID,
});

export async function createDealAction(_prev: CrmState, form: FormData): Promise<CrmState> {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") return { error: "Le rôle « lecture seule » ne permet pas d'ouvrir une affaire." };
  const parsed = createSchema.safeParse({
    propertyId: form.get("propertyId"), buyerContactId: form.get("buyerContactId"), sellerContactId: form.get("sellerContactId"),
    price: form.get("price"), fees: form.get("fees"), offerAcceptedOn: form.get("offerAcceptedOn"),
    ownerUserId: assigns(ctx) ? form.get("ownerUserId") || ctx.user.id : ctx.user.id,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  const d = parsed.data;
  let id: string | null = null;
  try {
    id = await withTenant(getTenantPool(), tenant(ctx), async (_db, c) => {
      for (const contactId of [d.buyerContactId, d.sellerContactId]) {
        if (contactId && !(await c.query("SELECT 1 FROM app.contacts WHERE id = $1", [contactId])).rowCount) return null;
      }
      const newId = (await c.query<{ id: string }>(
        `INSERT INTO app.deals (org_id, property_id, owner_user_id, buyer_contact_id, seller_contact_id, price, fees, offer_accepted_on, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [ctx.org.id, d.propertyId, d.ownerUserId, d.buyerContactId, d.sellerContactId, d.price, d.fees, d.offerAcceptedOn, ctx.user.id],
      )).rows[0]!.id;
      await syncPropertyStatus(c, newId, "offre");
      return newId;
    });
  } catch (e) {
    if ((e as { code?: string }).code === "42501") return { error: "Vous ne pouvez pas ouvrir cette affaire (bien non visible ou responsable hors de vos droits)." };
    throw e;
  }
  if (!id) return { error: "Contact introuvable." };
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "affaire.creee", targetType: "affaire", targetId: id });
  redirect(`/app/affaires/${id}`);
}

const datesSchema = z.object({
  id: UUID,
  price: optionalAmount,
  fees: optionalAmount,
  offerAcceptedOn: optionalDate,
  compromisSignedOn: optionalDate,
  retractionNotifiedOn: optionalDate,
  loanDeadline: optionalDate,
  deedPlannedOn: optionalDate,
  deedSignedOn: optionalDate,
  notary: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(200).nullable()),
  notes: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(5000).nullable()),
});

export async function updateDealAction(_prev: CrmState, form: FormData): Promise<CrmState> {
  const ctx = await requireAgency();
  const parsed = datesSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  const d = parsed.data;
  if (d.compromisSignedOn && d.retractionNotifiedOn && d.retractionNotifiedOn < d.compromisSignedOn) {
    return { error: "La notification à l'acquéreur ne peut pas précéder la signature du compromis." };
  }
  const updated = await withTenant(getTenantPool(), tenant(ctx), async (_db, c) =>
    (await c.query(
      `UPDATE app.deals SET price = $2, fees = $3, offer_accepted_on = $4, compromis_signed_on = $5, retraction_notified_on = $6,
         loan_deadline = $7, deed_planned_on = $8, deed_signed_on = $9, notary = $10, notes = $11, updated_at = now()
       WHERE id = $1`,
      [d.id, d.price, d.fees, d.offerAcceptedOn, d.compromisSignedOn, d.retractionNotifiedOn, d.loanDeadline, d.deedPlannedOn, d.deedSignedOn, d.notary, d.notes],
    )).rowCount ?? 0);
  if (!updated) return { error: "Seul le négociateur en charge (ou le gérant, un manager, un assistant) peut modifier cette affaire." };
  revalidatePath(`/app/affaires/${d.id}`);
  return { success: "Affaire enregistrée." };
}

export async function setDealStageAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  const id = UUID.parse(form.get("id"));
  const stage = z.enum(["offre", "compromis", "conditions_levees", "acte", "abandon"]).parse(form.get("stage"));
  const changed = await withTenant(getTenantPool(), tenant(ctx), async (_db, c) => {
    const n = (await c.query(
      `UPDATE app.deals SET stage = $2,
         deed_signed_on = CASE WHEN $2 = 'acte' THEN coalesce(deed_signed_on, (now() AT TIME ZONE 'Europe/Paris')::date) ELSE deed_signed_on END,
         updated_at = now()
       WHERE id = $1 AND stage <> $2`,
      [id, stage],
    )).rowCount ?? 0;
    if (n) await syncPropertyStatus(c, id, stage);
    return n;
  });
  if (changed) await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "affaire.etape", targetType: "affaire", targetId: id, details: { etape: stage } });
  revalidatePath(`/app/affaires/${id}`);
  revalidatePath("/app/affaires");
}

export async function toggleChecklistAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  const id = UUID.parse(form.get("id"));
  const key = z.string().refine((k) => CHECKLIST_KEYS.has(k)).parse(form.get("key"));
  const done = form.get("done") === "1";
  await withTenant(getTenantPool(), tenant(ctx), (_db, c) =>
    c.query(`UPDATE app.deals SET checklist = jsonb_set(checklist, ARRAY[$2::text], to_jsonb($3::boolean)), updated_at = now() WHERE id = $1`, [id, key, done]));
  revalidatePath(`/app/affaires/${id}`);
}
