import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/agency/context";
import { agencyMembers, contactName, listContacts } from "@/lib/crm/data";
import { CONTACT_ROLES } from "@/lib/crm/labels";
import { buttonClass, LinkButton } from "@/ui/button";
import { Input } from "@/ui/form";
import { Badge, Card, PageHeader } from "@/ui/surface";
import { EmptyState, memberName, VisibilityBadge } from "../_crm/parts";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireAgency();
  const q = (await searchParams).q?.slice(0, 100) ?? "";
  const [contacts, members] = await Promise.all([listContacts(ctx, q), agencyMembers(ctx.org.id)]);

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Acquéreurs, vendeurs et investisseurs de l'agence. Un contact privé n'est visible que par son responsable, le gérant et les managers."
        actions={
          ctx.role !== "lecture" ? (
            <>
              <LinkButton href="/app/contacts/import" variant="secondary">Importer (CSV)</LinkButton>
              <LinkButton href="/app/contacts/nouveau">Nouveau contact</LinkButton>
            </>
          ) : null
        }
      />
      <form role="search" className="mb-4 flex max-w-md gap-2">
        <Input name="q" defaultValue={q} placeholder="Nom, e-mail ou téléphone" aria-label="Rechercher un contact" />
        <button type="submit" className={buttonClass("secondary")}>
          Rechercher
        </button>
      </form>
      <Card>
        {contacts.length === 0 ? (
          <EmptyState title={q ? "Aucun contact ne correspond à cette recherche." : "Aucun contact pour le moment."}>
            {q ? null : "Ajoutez votre premier acquéreur ou vendeur."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {contacts.map((c) => (
              <li key={c.id}>
                <Link href={`/app/contacts/${c.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5 hover:bg-surface-muted">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{contactName(c)}</p>
                    <p className="truncate text-[13px] text-ink-muted">
                      {[c.email, c.phone].filter(Boolean).join(" · ") || "Aucune coordonnée"} · {memberName(members, c.owner_user_id)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <VisibilityBadge visibility={c.visibility} />
                    {c.roles.map((r) => (
                      <Badge key={r} tone="brand">
                        {CONTACT_ROLES[r]}
                      </Badge>
                    ))}
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
