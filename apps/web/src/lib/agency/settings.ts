import { schema, withTenant } from "@immopilot/db";
import { eq } from "drizzle-orm";
import { getTenantPool } from "../server/db";
import type { AgencyContext } from "./context";

export interface AgencySettings {
  defaultVisibility: "private" | "agency";
  /** Lien vers le barème des honoraires de l'agence (cité dans les annonces). */
  feeScheduleUrl: string | null;
  /** false tant que l'agence n'a jamais enregistré ses paramètres (valeurs par défaut affichées). */
  configured: boolean;
  updatedAt: Date | null;
}

export async function getAgencySettings(ctx: AgencyContext): Promise<AgencySettings> {
  const rows = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, (db) =>
    db.select().from(schema.organizationSettings).where(eq(schema.organizationSettings.orgId, ctx.org.id)),
  );
  const row = rows[0];
  return row
    ? { defaultVisibility: row.defaultVisibility, feeScheduleUrl: row.feeScheduleUrl, configured: true, updatedAt: row.updatedAt }
    : { defaultVisibility: "agency", feeScheduleUrl: null, configured: false, updatedAt: null };
}
