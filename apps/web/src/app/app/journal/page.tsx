import { schema, withTenant } from "@immopilot/db";
import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireAgency } from "@/lib/agency/context";
import { canReadAuditLog } from "@/lib/agency/rules";
import { AUDIT_LABELS, type AuditAction } from "@/lib/audit";
import { getAuth } from "@/lib/auth/server";
import { getTenantPool } from "@/lib/server/db";
import { Alert, Card, PageHeader } from "@/ui/surface";

export const metadata: Metadata = { title: "Journal d'audit" };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

function describe(details: Record<string, unknown>): string {
  return Object.entries(details)
    .map(([key, value]) => `${key} : ${String(value)}`)
    .join(" · ");
}

export default async function AuditPage() {
  const ctx = await requireAgency();
  if (!canReadAuditLog(ctx.role)) {
    return (
      <>
        <PageHeader title="Journal d'audit" />
        <Alert tone="warning">Le journal d&apos;audit est réservé au gérant et aux managers.</Alert>
      </>
    );
  }

  // La base filtre aussi (politique audit_read) : même un appel direct ne renverrait rien.
  const entries = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, (db) =>
    db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.at)).limit(200),
  );
  const full = await getAuth().api.getFullOrganization({ headers: await headers(), query: { organizationId: ctx.org.id } });
  const names = new Map((full?.members ?? []).map((m) => [m.userId, m.user.name]));

  return (
    <>
      <PageHeader
        title="Journal d'audit"
        description="Les actions sensibles de l'agence, en ajout seul : personne, pas même le gérant, ne peut modifier ou effacer une entrée."
      />
      <Card>
        {entries.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-muted">Aucune action enregistrée pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-[12px] uppercase tracking-wide text-ink-muted">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Auteur</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Action</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entries.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="tabular whitespace-nowrap px-5 py-3 text-ink-muted">{dateFmt.format(e.at)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-ink">{names.get(e.actorUserId) ?? "Ancien membre"}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-ink">{AUDIT_LABELS[e.action as AuditAction] ?? e.action}</td>
                    <td className="px-5 py-3 text-[13px] text-ink-muted">{describe(e.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
