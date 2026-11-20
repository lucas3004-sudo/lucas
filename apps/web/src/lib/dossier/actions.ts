"use server";
/**
 * Création et suppression de dossiers de biens.
 * L'adresse transmise par le navigateur n'est PAS crue sur parole : elle est géocodée de
 * nouveau côté serveur et doit correspondre au même identifiant BAN.
 */
import { schema, withTenant } from "@immopilot/db";
import { geocode } from "@immopilot/integrations";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "../agency/actions";
import { requireAgency } from "../agency/context";
import { audit } from "../audit";
import { getTenantPool } from "../server/db";
import { computeDossier } from "./compute";

const inputSchema = z.object({
  label: z.string().trim().min(3, "Choisissez une adresse dans la liste.").max(200),
  banId: z.string().trim().min(5, "Choisissez une adresse dans la liste.").max(64),
  type: z.enum(["Appartement", "Maison"], "Type de bien inconnu."),
  surface: z.coerce.number("Surface invalide.").min(9, "Surface minimale : 9 m².").max(2000, "Surface maximale : 2 000 m²."),
  rooms: z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.number().int().min(1).max(30).nullable()),
});

export async function createDossierAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") return { error: "Le rôle « lecture seule » ne permet pas de créer un dossier." };
  const parsed = inputSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  const { label, banId, type, surface, rooms } = parsed.data;

  let address;
  try {
    address = (await geocode(label, { limit: 5 })).find((a) => a.banId === banId);
  } catch {
    return { error: "Le service d'adresses (BAN) ne répond pas. Réessayez dans un instant." };
  }
  if (!address) return { error: "Adresse non reconnue. Choisissez-la dans la liste proposée." };

  const pool = getTenantPool();
  const inputs = { type, surface, rooms };
  const snapshot = await computeDossier(pool, address, inputs);
  const [row] = await withTenant(pool, { orgId: ctx.org.id, userId: ctx.user.id }, (db) =>
    db
      .insert(schema.analyses)
      .values({
        orgId: ctx.org.id,
        createdBy: ctx.user.id,
        addressLabel: address.label,
        banId: address.banId,
        inseeCode: address.inseeCode,
        inputs,
        snapshot: snapshot as unknown as Record<string, unknown>,
      })
      .returning({ id: schema.analyses.id }),
  );
  if (!row) return { error: "L'enregistrement du dossier a échoué." };
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "dossier.cree", targetType: "dossier", targetId: row.id, details: { adresse: address.label } });
  redirect(`/app/biens/${row.id}`);
}

export async function deleteDossierAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  const id = String(form.get("id") ?? "");
  // La base n'autorise la suppression qu'au gérant et aux managers (politique analyses_delete).
  const deleted = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, (db) =>
    db.delete(schema.analyses).where(eq(schema.analyses.id, id)).returning({ id: schema.analyses.id, label: schema.analyses.addressLabel }),
  );
  if (deleted[0]) {
    await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "dossier.supprime", targetType: "dossier", targetId: id, details: { adresse: deleted[0].label } });
  }
  revalidatePath("/app/biens");
  redirect("/app/biens");
}
