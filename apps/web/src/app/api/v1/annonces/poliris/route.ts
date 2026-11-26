/**
 * Export des annonces au format SeLoger « Poliris » (D-070) : un ZIP à envoyer aux portails ou à
 * une passerelle de multidiffusion (Ubiflow…). Gérant et managers seulement ; seuls les biens sous
 * mandat dont les mentions obligatoires sont complètes y figurent. Journalisé, sans donnée personnelle.
 */
import { withTenant } from "@immopilot/db";
import { encodeWindows1252, polirisConfig, POLIRIS_PHOTOS_CFG, polirisCsv, type PolirisListing } from "@immopilot/domain";
import { strToU8, zipSync, type Zippable } from "fflate";
import { requireAgency } from "@/lib/agency/context";
import { audit } from "@/lib/audit";
import { polirisCandidates } from "@/lib/crm/poliris-export";
import { getTenantPool } from "@/lib/server/db";

export async function GET() {
  const ctx = await requireAgency();
  if (ctx.role !== "gerant" && ctx.role !== "manager") {
    return Response.json({ error: "Export réservé au gérant et aux managers." }, { status: 403 });
  }
  const { ready, incomplete } = await polirisCandidates(ctx);
  if (!ready.length) {
    return Response.json({ error: "Aucune annonce prête : complétez les mentions obligatoires des biens sous mandat." }, { status: 409 });
  }
  const photos = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    (await c.query<{ property_id: string; content_type: string; bytes: Buffer }>(
      "SELECT property_id, content_type, bytes FROM app.property_photos WHERE property_id = ANY($1) ORDER BY property_id, position, created_at",
      [ready.map((r) => r.property.id)],
    )).rows);

  const files: Zippable = {};
  const listings: PolirisListing[] = ready.map(({ property, listing }) => {
    const own = photos.filter((p) => p.property_id === property.id).slice(0, 30);
    const names = own.map((p, i) => {
      const name = `${listing.technicalId}-${i + 1}.${p.content_type === "image/png" ? "png" : "jpg"}`;
      files[name] = [new Uint8Array(p.bytes), { level: 0 }];
      return name;
    });
    return { ...listing, photos: names };
  });
  files["Annonces.csv"] = encodeWindows1252(polirisCsv(listings));
  files["Config.txt"] = strToU8(polirisConfig("1.0"));
  files["Photos.cfg"] = strToU8(POLIRIS_PHOTOS_CFG);
  const zip = zipSync(files, { level: 6 });
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "biens.export_poliris", details: { annonces: listings.length, a_completer: incomplete } });
  return new Response(new Uint8Array(zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="annonces-seloger-${ctx.org.slug}.zip"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
