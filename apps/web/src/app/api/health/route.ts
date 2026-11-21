/**
 * État de santé public (surveillance du déploiement) : base joignable et à jour.
 * Ne renvoie que des nombres, jamais de nom de migration ni de détail technique.
 */
import { schemaStatus } from "@/lib/server/schema-check";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const s = await schemaStatus();
    return Response.json(
      { statut: s.ok ? "ok" : "base_en_retard", migrations: { attendues: s.expected, appliquees: s.applied } },
      { status: s.ok ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ statut: "base_injoignable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
