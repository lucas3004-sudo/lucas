import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/agency/context";
import { qualityReport } from "@/lib/quality/report";
import { cn } from "@/ui/cn";
import { Badge, Card, CardHeader, PageHeader } from "@/ui/surface";

export const metadata: Metadata = { title: "Qualité des données" };

type Item = { key: string; label: string; href: string; detail?: string };

function Section({ title, why, items }: { title: string; why: string; items: Item[] }) {
  return (
    <Card>
      <CardHeader title={title} description={why} action={<Badge tone={items.length ? "warning" : "success"}>{items.length}</Badge>} />
      {items.length === 0 ? (
        <p className="px-5 py-3 text-sm text-ink-muted">Rien à signaler.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.slice(0, 10).map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="flex flex-wrap items-center gap-x-3 px-5 py-2.5 hover:bg-surface-muted">
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{i.label}</span>
                {i.detail ? <span className="text-xs text-ink-muted">{i.detail}</span> : null}
              </Link>
            </li>
          ))}
          {items.length > 10 ? <li className="px-5 py-2 text-xs text-ink-muted">… et {items.length - 10} autre(s).</li> : null}
        </ul>
      )}
    </Card>
  );
}

export default async function QualityPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const ctx = await requireAgency();
  const seesAll = ctx.role === "gerant" || ctx.role === "manager";
  const scopeAll = seesAll && (await searchParams).vue === "agence";
  const r = await qualityReport(ctx, scopeAll);
  const { noConsent, duplicates, listings, incomplete, lateDeals, broad, noDetails, expiredMandates } = r;
  const total = noConsent.length + noDetails.length + duplicates.length + incomplete.length + listings.length + broad.length + lateDeals.length + expiredMandates.length;
  const tab = (active: boolean) =>
    cn("rounded-[var(--radius-control)] px-3 py-1.5 text-sm", active ? "bg-brand-soft font-medium text-brand-text" : "text-ink-muted hover:bg-surface-muted");

  return (
    <>
      <PageHeader
        title="Qualité des données"
        description={`Contrôle automatique, sans IA : ${total} point(s) à reprendre. Rien n'est corrigé sans vous.`}
      />
      {seesAll ? (
        <nav aria-label="Périmètre" className="mb-4 flex gap-1">
          <Link href="/app/qualite" className={tab(!scopeAll)} aria-current={!scopeAll ? "page" : undefined}>Mes éléments</Link>
          <Link href="/app/qualite?vue=agence" className={tab(scopeAll)} aria-current={scopeAll ? "page" : undefined}>Toute l&apos;agence</Link>
        </nav>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Contacts sans consentement de prospection"
          why="Ne les démarchez pas par téléphone, e-mail ou SMS avant d'avoir recueilli et enregistré leur accord (avec sa preuve)."
          items={noConsent}
        />
        <Section title="Doublons probables" why="Même e-mail, même téléphone ou même nom complet. Vérifiez avant de fusionner à la main." items={duplicates} />
        <Section title="Annonces incomplètes" why="Biens sous mandat ou sous offre dont l'annonce n'a pas toutes ses mentions obligatoires." items={listings} />
        <Section title="Biens incomplets pour le rapprochement" why="Sans prix, surface ou nombre de pièces, les correspondances restent « à vérifier »." items={incomplete} />
        <Section title="Affaires avec une échéance dépassée" why="Rétractation, prêt ou signature de l'acte : à mettre à jour ou à traiter." items={lateDeals} />
        <Section title="Profils de recherche trop larges" why="Sans budget ni secteur, le profil correspond à presque tous les biens." items={broad} />
        <Section title="Contacts sans coordonnées" why="Ni e-mail ni téléphone : impossible de les recontacter." items={noDetails} />
        <Section title="Mandats expirés" why="Biens encore affichés sous mandat alors que la date de fin est passée : renouvelez le mandat ou changez le statut." items={expiredMandates} />
      </div>
    </>
  );
}
