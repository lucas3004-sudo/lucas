/** Téléchargement des données d'un contact (droit d'accès RGPD). */
import { z } from "zod";
import { requireAgency } from "@/lib/agency/context";
import { exportContact } from "@/lib/crm/export";

const problem = (status: number, title: string) =>
  new Response(JSON.stringify({ type: "about:blank", title, status }), { status, headers: { "content-type": "application/problem+json" } });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return problem(404, "Contact introuvable");
  const ctx = await requireAgency();
  const result = await exportContact(ctx, id.data);
  if (result.status === "not_found") return problem(404, "Contact introuvable");
  if (result.status === "forbidden") return problem(403, "Seul le responsable du contact (ou le gérant, un manager, un assistant) peut exporter ses données.");
  return new Response(JSON.stringify(result.data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="contact-${id.data}.json"`,
      "cache-control": "no-store",
    },
  });
}
