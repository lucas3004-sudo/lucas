"use server";
/**
 * Actions de la prospection (D-072). Mêmes droits que le bien (RLS de app.properties) : son
 * responsable, le gérant, les managers et les assistants le font avancer. Le journal ne garde que
 * des identifiants et le statut, jamais de donnée personnelle.
 */
import { withTenant } from "@immopilot/db";
import {
  defaultFollowUpOn, FOLLOW_UP_PREFIX, followUpTitle, PROSPECTION_STATUSES, prospectionEffects, utcToParisLocal,
} from "@immopilot/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAgency } from "../agency/context";
import { audit } from "../audit";
import { getTenantPool } from "../server/db";

const UUID = z.uuid();
const today = () => utcToParisLocal(new Date()).slice(0, 10);

function refresh(id: string) {
  revalidatePath("/app/prospection");
  revalidatePath(`/app/proprietes/${id}`);
}

/** Change le statut de prospection ; « Relance à effectuer » crée (ou décale) la tâche de relance. */
export async function setProspectionStatusAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") return;
  const id = UUID.parse(form.get("id"));
  const status = z.enum(PROSPECTION_STATUSES).parse(form.get("status"));
  const asked = z.iso.date().safeParse(form.get("followUpOn"));
  const followUpOn = asked.success && asked.data >= today() ? asked.data : defaultFollowUpOn(today());

  const result = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) => {
    const prop = (await c.query<{ owner_user_id: string; address_label: string; status: string; seller_contact_id: string | null }>(
      "SELECT owner_user_id, address_label, status, seller_contact_id FROM app.properties WHERE id = $1 AND prospection_status IS NOT NULL", [id],
    )).rows[0];
    if (!prop) return null;
    const effects = prospectionEffects(status, prop.status);
    const updated = await c.query(
      `UPDATE app.properties SET prospection_status = $2, status = CASE WHEN $3 THEN 'mandat' ELSE status END, updated_at = now() WHERE id = $1`,
      [id, status, effects.toMandate],
    );
    if (!updated.rowCount) return null;
    let taskId: string | null = null;
    if (effects.followUp) {
      const open = (await c.query<{ id: string }>(
        "SELECT id FROM app.tasks WHERE property_id = $1 AND status = 'a_faire' AND title LIKE $2 ORDER BY created_at LIMIT 1", [id, `${FOLLOW_UP_PREFIX}%`],
      )).rows[0];
      if (open) {
        await c.query("UPDATE app.tasks SET due_on = $2 WHERE id = $1", [open.id, followUpOn]);
      } else {
        taskId = (await c.query<{ id: string }>(
          `INSERT INTO app.tasks (org_id, assignee_user_id, created_by, title, details, due_on, property_id, contact_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [ctx.org.id, prop.owner_user_id, ctx.user.id, followUpTitle(prop.address_label),
           "Relance de prospection : reprenez contact avec le propriétaire (avec son accord pour un appel ou un e-mail).",
           followUpOn, id, prop.seller_contact_id],
        )).rows[0]!.id;
      }
    }
    return { taskId, toMandate: effects.toMandate };
  });
  if (!result) return;
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "bien_agence.prospection", targetType: "bien", targetId: id, details: { statut: status } });
  if (result.taskId) {
    await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "tache.creee", targetType: "tache", targetId: result.taskId, details: { motif: "relance_prospection" } });
  }
  refresh(id);
}

/** Marque ou retire un favori (sans changer la date de suivi). */
export async function setProspectionFavoriteAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") return;
  const id = UUID.parse(form.get("id"));
  const favorite = form.get("favorite") === "1";
  await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, (_db, c) =>
    c.query("UPDATE app.properties SET prospection_favorite = $2 WHERE id = $1 AND prospection_status IS NOT NULL", [id, favorite]));
  refresh(id);
}

/** Un bien déjà saisi (prospect) entre dans la liste de prospection, « à contacter ». */
export async function followPropertyAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") return;
  const id = UUID.parse(form.get("id"));
  const updated = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, (_db, c) =>
    c.query("UPDATE app.properties SET prospection_status = 'a_contacter', updated_at = now() WHERE id = $1 AND prospection_status IS NULL", [id]));
  if (updated.rowCount) {
    await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "bien_agence.prospection", targetType: "bien", targetId: id, details: { statut: "a_contacter" } });
  }
  refresh(id);
}

/** Rattache au bien son propriétaire : un contact visible, qui devient « vendeur ». */
export async function setSellerContactAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") return;
  const id = UUID.parse(form.get("id"));
  const raw = form.get("sellerContactId");
  const contactId = raw ? UUID.parse(raw) : null;
  await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) => {
    if (contactId) {
      // Le contact doit être visible (RLS) ; il prend le rôle « vendeur » si on peut le modifier.
      if (!(await c.query("SELECT 1 FROM app.contacts WHERE id = $1", [contactId])).rowCount) return;
      await c.query("UPDATE app.contacts SET roles = array_append(roles, 'vendeur'), updated_at = now() WHERE id = $1 AND NOT ('vendeur' = ANY (roles))", [contactId]);
    }
    await c.query("UPDATE app.properties SET seller_contact_id = $2, updated_at = now() WHERE id = $1", [id, contactId]);
  });
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "bien_agence.proprietaire", targetType: "bien", targetId: id, details: { rattache: contactId !== null } });
  refresh(id);
}

