"use server";
/** Ouverture de la page publique « Estimez votre bien » et choix du destinataire (gérant, manager). */
import { withTenant } from "@immopilot/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAgency } from "../agency/context";
import { audit } from "../audit";
import { getTenantPool } from "../server/db";

export async function setPublicPageAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  if (ctx.role !== "gerant" && ctx.role !== "manager") redirect("/app/parametres?page=droits#page-estimation");
  const enabled = form.get("enabled") === "on";
  const owner = z.uuid().safeParse(form.get("owner"));
  if (!owner.success) redirect("/app/parametres?page=destinataire#page-estimation");
  const done = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) => {
    try {
      await c.query(
        `INSERT INTO app.agency_public_pages (org_id, estimation_enabled, lead_owner_user_id, updated_by) VALUES ($1, $2, $3, $4)
         ON CONFLICT (org_id) DO UPDATE SET estimation_enabled = EXCLUDED.estimation_enabled, lead_owner_user_id = EXCLUDED.lead_owner_user_id,
           updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [ctx.org.id, enabled, owner.data, ctx.user.id],
      );
      return true;
    } catch (e) {
      if ((e as { code?: string }).code === "42501") return false;
      throw e;
    }
  });
  if (!done) redirect("/app/parametres?page=destinataire#page-estimation");
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "agence.page_estimation", details: { ouverte: enabled } });
  revalidatePath("/app/parametres");
  redirect("/app/parametres?page=ok#page-estimation");
}
