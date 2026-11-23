import { schema, withTenant } from "@immopilot/db";
import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { requireAgency } from "@/lib/agency/context";
import { getAuth } from "@/lib/auth/server";
import type { DossierSnapshot } from "@/lib/dossier/types";
import { fmt } from "@/lib/format";
import { getTenantPool } from "@/lib/server/db";
import { LinkButton } from "@/ui/button";
import { Badge, Card, PageHeader } from "@/ui/surface";

export const metadata: Metadata = { title: "Estimations" };

export default async function DossiersPage() {
  const ctx = await requireAgency();
  const rows = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, (db) =>
    db.select().from(schema.analyses).orderBy(desc(schema.analyses.createdAt)).limit(100),
  );
  const full = await getAuth().api.getFullOrganization({ headers: await headers(), query: { organizationId: ctx.org.id } });
  const names = new Map((full?.members ?? []).map((m) => [m.userId, m.user.name]));

  return (
    <>
      <PageHeader
        title="Estimations"
        description="À partir d'une adresse : ventes comparables (DVF), DPE, risques, loyers et estimation indicative, chaque chiffre sourcé et daté."
        actions={ctx.role !== "lecture" ? <LinkButton href="/app/biens/nouveau">Nouveau dossier</LinkButton> : null}
      />
      <Card>
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-ink">Aucun dossier pour le moment.</p>
            <p className="mt-1 text-sm text-ink-muted">Créez le premier à partir d&apos;une adresse.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => {
              const snap = row.snapshot as unknown as DossierSnapshot;
              const est = snap.estimate.value;
              const inputs = snap.inputs.value;
              return (
                <li key={row.id}>
                  <Link href={`/app/biens/${row.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5 hover:bg-surface-muted">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{row.addressLabel}</p>
                      <p className="text-[13px] text-ink-muted">
                        {inputs ? `${inputs.type}, ${fmt.number(inputs.surface)} m²` : null} · {fmt.date(row.createdAt)} · {names.get(row.createdBy) ?? "Ancien membre"}
                      </p>
                    </div>
                    {est && est.status === "ok" ? (
                      <span className="tabular text-sm font-medium text-ink">
                        {fmt.euros(est.low)} – {fmt.euros(est.high)}
                      </span>
                    ) : (
                      <Badge>Sans estimation</Badge>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
