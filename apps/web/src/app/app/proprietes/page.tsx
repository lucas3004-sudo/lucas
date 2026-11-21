import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/agency/context";
import { agencyMembers, listProperties } from "@/lib/crm/data";
import { fmt } from "@/lib/format";
import { LinkButton } from "@/ui/button";
import { Card, PageHeader } from "@/ui/surface";
import { EmptyState, memberName, PropertyStatusBadge, VisibilityBadge } from "../_crm/parts";

export const metadata: Metadata = { title: "Biens de l'agence" };

export default async function PropertiesPage() {
  const ctx = await requireAgency();
  const [properties, members] = await Promise.all([listProperties(ctx), agencyMembers(ctx.org.id)]);
  return (
    <>
      <PageHeader
        title="Biens de l'agence"
        description="Les biens en portefeuille. Chaque bien proposé est rapproché automatiquement des profils de recherche de toute l'agence."
        actions={
          ctx.role !== "lecture" ? (
            <>
              <LinkButton href="/app/proprietes/import" variant="secondary">Importer (CSV)</LinkButton>
              <LinkButton href="/app/proprietes/nouveau">Nouveau bien</LinkButton>
            </>
          ) : null
        }
      />
      <Card>
        {properties.length === 0 ? (
          <EmptyState title="Aucun bien pour le moment.">Ajoutez un bien en mandat pour voir les acquéreurs correspondants.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {properties.map((p) => (
              <li key={p.id}>
                <Link href={`/app/proprietes/${p.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5 hover:bg-surface-muted">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{p.address_label}</p>
                    <p className="text-[13px] text-ink-muted">
                      {[p.type, p.surface !== null ? `${fmt.number(p.surface)} m²` : null, p.rooms !== null ? `${p.rooms} p.` : null].filter(Boolean).join(", ")} ·{" "}
                      {memberName(members, p.owner_user_id)}
                    </p>
                  </div>
                  {p.price !== null ? <span className="tabular text-sm font-medium text-ink">{fmt.euros(p.price)}</span> : null}
                  <div className="flex gap-1.5">
                    <VisibilityBadge visibility={p.visibility} />
                    <PropertyStatusBadge status={p.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
