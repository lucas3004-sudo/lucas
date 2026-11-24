/** Réglage de la page publique « Estimez votre bien » de l'agence (D-067), lu sous RLS. */
import { withTenant } from "@immopilot/db";
import type { AgencyContext } from "../agency/context";
import { getTenantPool } from "../server/db";

export async function publicPageSettings(ctx: AgencyContext): Promise<{ enabled: boolean; leadOwnerUserId: string | null }> {
  const row = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    (await c.query<{ estimation_enabled: boolean; lead_owner_user_id: string }>("SELECT estimation_enabled, lead_owner_user_id FROM app.agency_public_pages")).rows[0]);
  return { enabled: row?.estimation_enabled ?? false, leadOwnerUserId: row?.lead_owner_user_id ?? null };
}
