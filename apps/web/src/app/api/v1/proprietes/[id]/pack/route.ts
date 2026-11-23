/**
 * Pack annonce (D-066) : un fichier ZIP avec le texte de l'annonce (titre, description, mentions)
 * et toutes les photos du bien, prêts à envoyer sur les portails. Réservé aux utilisateurs
 * connectés qui voient le bien (RLS), et seulement si les mentions obligatoires sont complètes.
 */
import { withTenant } from "@immopilot/db";
import { strToU8, zipSync, type Zippable } from "fflate";
import { z } from "zod";
import { requireAgency } from "@/lib/agency/context";
import { listingFor } from "@/lib/crm/listing";
import { getTenantPool } from "@/lib/server/db";

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "bien";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new Response(null, { status: 404 });
  const ctx = await requireAgency();
  const listing = await listingFor(ctx, id.data);
  if (!listing) return new Response(null, { status: 404 });
  if (!listing.publishable) {
    return Response.json({ error: "Mentions obligatoires incomplètes : complétez l'annonce avant de la diffuser." }, { status: 409 });
  }
  const photos = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    (await c.query<{ content_type: string; bytes: Buffer }>(
      "SELECT content_type, bytes FROM app.property_photos WHERE property_id = $1 ORDER BY position, created_at", [id.data],
    )).rows);

  // Fins de ligne Windows : le texte s'ouvre proprement dans le Bloc-notes.
  const crlf = (s: string) => s.replace(/\r?\n/g, "\r\n");
  const files: Zippable = {
    "annonce.txt": strToU8(crlf(`${listing.parts.title}\n\n${listing.parts.body}\n`)),
    "titre.txt": strToU8(listing.parts.title),
    "description.txt": strToU8(crlf(listing.parts.body)),
  };
  photos.forEach((p, i) => {
    const ext = p.content_type === "image/png" ? "png" : "jpg";
    // Les photos sont déjà compressées : on les range sans les recompresser.
    files[`photos/${String(i + 1).padStart(2, "0")}.${ext}`] = [new Uint8Array(p.bytes), { level: 0 }];
  });
  const zip = zipSync(files, { level: 6 });
  return new Response(new Uint8Array(zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="annonce-${slug(listing.property.address_label)}.zip"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
