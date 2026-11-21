/**
 * Export complet de l'agence, un type de données par fichier CSV (D-052).
 * Réservé au gérant, double authentification active ; chaque export est journalisé.
 */
import { getSession, requireAgency } from "@/lib/agency/context";
import { agencyMembers } from "@/lib/crm/data";
import { audit } from "@/lib/audit";
import { exportDataset, isExportDataset } from "@/lib/export/agency";
import { utcToParisLocal } from "@immopilot/domain";

const problem = (status: number, title: string) =>
  new Response(JSON.stringify({ type: "about:blank", title, status }), { status, headers: { "content-type": "application/problem+json" } });

export async function GET(_request: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  if (!isExportDataset(dataset)) return problem(404, "Type de données inconnu");
  const ctx = await requireAgency();
  if (ctx.role !== "gerant") return problem(403, "L'export complet de l'agence est réservé au gérant.");
  const session = await getSession();
  if (!(session?.user as { twoFactorEnabled?: boolean | null } | undefined)?.twoFactorEnabled) {
    return problem(403, "Activez la double authentification pour exporter les données de l'agence.");
  }
  const members = new Map((await agencyMembers(ctx.org.id)).map((m) => [m.userId, m.name]));
  const { csv, rows } = await exportDataset(ctx, dataset, members);
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "agence.export", details: { type: dataset, lignes: rows } });
  const date = utcToParisLocal(new Date()).slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="immopilot-${dataset}-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
