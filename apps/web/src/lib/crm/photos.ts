"use server";
/**
 * Photos des biens (D-042). Le navigateur réduit l'image ; le serveur revérifie TOUT :
 * format réel (JPEG ou PNG), métadonnées retirées (EXIF, position GPS), taille et dimensions.
 * La base applique les droits (migration 0012).
 */
import { withTenant } from "@immopilot/db";
import { InvalidImageError, sanitizeImage } from "@immopilot/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAgency } from "../agency/context";
import { audit } from "../audit";
import type { CrmState } from "./actions";
import { getTenantPool } from "../server/db";

import { MAX_PHOTOS, MAX_PHOTO_BYTES as MAX_BYTES } from "./photo-limits";

export async function uploadPhotoAction(_prev: CrmState, form: FormData): Promise<CrmState> {
  const ctx = await requireAgency();
  const propertyId = z.uuid().safeParse(form.get("propertyId"));
  if (!propertyId.success) return { error: "Bien introuvable." };
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Aucune photo reçue." };
  if (file.size > MAX_BYTES) return { error: "Photo trop lourde (1,5 Mo au maximum après réduction)." };

  let image;
  try {
    image = sanitizeImage(new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    if (e instanceof InvalidImageError) return { error: e.message };
    throw e;
  }

  let id: string | null;
  try {
    id = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) => {
      const n = Number((await c.query("SELECT count(*)::int AS n FROM app.property_photos WHERE property_id = $1", [propertyId.data])).rows[0].n);
      if (n >= MAX_PHOTOS) return null;
      return (await c.query<{ id: string }>(
        `INSERT INTO app.property_photos (org_id, property_id, content_type, bytes, width, height, position, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [ctx.org.id, propertyId.data, image.type, Buffer.from(image.bytes), image.width, image.height, n, ctx.user.id],
      )).rows[0]!.id;
    });
  } catch (e) {
    if ((e as { code?: string }).code === "42501") return { error: "Seul le responsable du bien (ou le gérant, un manager, un assistant) peut ajouter des photos." };
    throw e;
  }
  if (!id) return { error: `Ce bien a déjà ${MAX_PHOTOS} photos : supprimez-en une avant d'en ajouter.` };
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "photo.ajoutee", targetType: "bien", targetId: propertyId.data });
  revalidatePath(`/app/proprietes/${propertyId.data}`);
  return { success: "Photo ajoutée." };
}

export async function deletePhotoAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  const id = z.uuid().parse(form.get("id"));
  const propertyId = z.uuid().parse(form.get("propertyId"));
  const deleted = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    (await c.query("DELETE FROM app.property_photos WHERE id = $1 AND property_id = $2", [id, propertyId])).rowCount ?? 0);
  if (deleted) await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "photo.supprimee", targetType: "bien", targetId: propertyId });
  revalidatePath(`/app/proprietes/${propertyId}`);
}
