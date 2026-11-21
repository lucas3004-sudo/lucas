/**
 * Fusion de deux contacts en double (action L2 : exécutée seulement après approbation).
 * Tout est rattaché au contact conservé : consentements (preuves recopiées avec leur date
 * d'origine), profils de recherche, tâches, rendez-vous, affaires, biens vendus. Le doublon est
 * ensuite supprimé. S'exécute dans la transaction de la décision, avec l'identité du décideur.
 */
import { normalizeEmail, normalizePhone } from "@immopilot/domain";
import type pg from "pg";
import type { AgencyContext } from "../agency/context";

export class MergeError extends Error {}

export async function mergeContacts(c: pg.PoolClient, ctx: AgencyContext, input: { keepId: string; removeId: string }): Promise<{ keptId: string }> {
  if (ctx.role !== "gerant" && ctx.role !== "manager") throw new MergeError("Seuls le gérant et les managers peuvent fusionner des contacts.");
  if (input.keepId === input.removeId) throw new MergeError("Les deux contacts sont identiques.");
  const { rows } = await c.query(
    "SELECT id, first_name, last_name, email, phone, roles, source, notes, owner_user_id FROM app.contacts WHERE id = ANY($1) FOR UPDATE",
    [[input.keepId, input.removeId]],
  );
  const keep = rows.find((r) => r.id === input.keepId);
  const remove = rows.find((r) => r.id === input.removeId);
  if (!keep || !remove) throw new MergeError("Contact introuvable : déjà fusionné, supprimé ou non visible.");

  const email = keep.email ?? remove.email;
  const phone = keep.phone ?? remove.phone;
  const notes = [keep.notes, remove.notes].filter(Boolean).join("\n\n— Fiche fusionnée —\n") || null;
  await c.query(
    `UPDATE app.contacts SET first_name = coalesce(first_name, $2), email = $3, phone = $4, email_norm = $5, phone_norm = $6,
       roles = ARRAY(SELECT DISTINCT unnest(roles || $7::text[])), source = coalesce(source, $8), notes = $9, updated_at = now()
     WHERE id = $1`,
    [keep.id, remove.first_name, email, phone, normalizeEmail(email), normalizePhone(phone), remove.roles, remove.source, notes?.slice(0, 5000) ?? null],
  );
  // Consentements : en ajout seul, ils sont recopiés (date d'origine conservée) avant la suppression du doublon.
  await c.query(
    `INSERT INTO app.contact_consents (org_id, contact_id, channel, status, obtained_at, expires_at, proof, recorded_by, recorded_at)
     SELECT org_id, $1, channel, status, obtained_at, expires_at, left('[Fusion] ' || proof, 1000), $3, recorded_at
     FROM app.contact_consents WHERE contact_id = $2`,
    [keep.id, remove.id, ctx.user.id],
  );
  await c.query("UPDATE app.buyer_profiles SET contact_id = $1, owner_user_id = $3, updated_at = now() WHERE contact_id = $2", [keep.id, remove.id, keep.owner_user_id]);
  await c.query("UPDATE app.tasks SET contact_id = $1 WHERE contact_id = $2", [keep.id, remove.id]);
  await c.query("UPDATE app.appointments SET contact_id = $1, updated_at = now() WHERE contact_id = $2", [keep.id, remove.id]);
  await c.query("UPDATE app.deals SET buyer_contact_id = $1, updated_at = now() WHERE buyer_contact_id = $2", [keep.id, remove.id]);
  await c.query("UPDATE app.deals SET seller_contact_id = $1, updated_at = now() WHERE seller_contact_id = $2", [keep.id, remove.id]);
  await c.query("UPDATE app.properties SET seller_contact_id = $1, updated_at = now() WHERE seller_contact_id = $2", [keep.id, remove.id]);
  const deleted = await c.query("DELETE FROM app.contacts WHERE id = $1", [remove.id]);
  if (!deleted.rowCount) throw new MergeError("Suppression du doublon refusée.");
  return { keptId: keep.id };
}
