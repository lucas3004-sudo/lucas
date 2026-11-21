/**
 * Affichage d'une photo de bien. Réservé aux utilisateurs connectés ; la base ne renvoie la
 * photo que si le bien est visible (RLS). Formats limités à JPEG et PNG (contrôlés à l'envoi).
 */
import { withTenant } from "@immopilot/db";
import { z } from "zod";
import { requireAgency } from "@/lib/agency/context";
import { getTenantPool } from "@/lib/server/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new Response(null, { status: 404 });
  const ctx = await requireAgency();
  const photo = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    (await c.query<{ content_type: string; bytes: Buffer }>("SELECT content_type, bytes FROM app.property_photos WHERE id = $1", [id.data])).rows[0]);
  if (!photo || (photo.content_type !== "image/jpeg" && photo.content_type !== "image/png")) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      "content-type": photo.content_type,
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
      // Une photo ne change jamais (pas de modification, seulement suppression) : cache privé long.
      "cache-control": "private, max-age=86400, immutable",
    },
  });
}
