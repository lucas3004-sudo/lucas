import { withTenant } from "@immopilot/db";
import {
  checkListing,
  contactsWithoutValidConsent,
  duplicateGroups,
  utcToParisLocal,
  type EnergyClass,
} from "@immopilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/agency/context";
import { getAgencySettings } from "@/lib/agency/settings";
import { contactName, type Property } from "@/lib/crm/data";
import { MATCHABLE_STATUSES } from "@/lib/crm/labels";
import { listDeals } from "@/lib/deals/data";
import { dealDeadlines } from "@/lib/deals/deadlines";
import { getTenantPool } from "@/lib/server/db";
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

const NUM = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export default async function QualityPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const ctx = await requireAgency();
  const seesAll = ctx.role === "gerant" || ctx.role === "manager";
  const scopeAll = seesAll && (await searchParams).vue === "agence";
  const mine = (owner: string) => scopeAll || owner === ctx.user.id;
  const today = utcToParisLocal(new Date()).slice(0, 10);

  const [data, settings, deals] = await Promise.all([
    withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) => ({
      contacts: (await c.query<{ id: string; first_name: string | null; last_name: string; email: string | null; phone: string | null; roles: string[]; owner_user_id: string }>(
        "SELECT id, first_name, last_name, email, phone, roles, owner_user_id FROM app.contacts",
      )).rows,
      consents: (await c.query<{ contact_id: string; channel: string; status: "accorde" | "retire"; expires_at: string | null; recorded_at: Date }>(
        "SELECT contact_id, channel, status, expires_at::text, recorded_at FROM app.contact_consents",
      )).rows,
      properties: (await c.query("SELECT * FROM app.properties WHERE status = ANY($1)", [MATCHABLE_STATUSES])).rows.map(
        (r) => ({ ...r, surface: NUM(r.surface), rooms: NUM(r.rooms), price: NUM(r.price), fees_percent: NUM(r.fees_percent) }) as Property,
      ),
      profiles: (await c.query<{ id: string; contact_id: string; owner_user_id: string; budget_max: string | null; insee_codes: string[] }>(
        "SELECT id, contact_id, owner_user_id, budget_max, insee_codes FROM app.buyer_profiles WHERE status = 'actif'",
      )).rows,
    })),
    getAgencySettings(ctx),
    listDeals(ctx),
  ]);

  const names = new Map(data.contacts.map((ct) => [ct.id, contactName(ct)]));
  const scopedContacts = data.contacts.filter((ct) => mine(ct.owner_user_id));

  const withRoles = scopedContacts.filter((ct) => ct.roles.length > 0);
  const noConsent = contactsWithoutValidConsent(
    withRoles.map((ct) => ct.id),
    data.consents.map((x) => ({ contactId: x.contact_id, channel: x.channel, status: x.status, expiresAt: x.expires_at, recordedAt: x.recorded_at })),
    today,
  ).map((id) => ({ key: id, label: names.get(id) ?? "Contact", href: `/app/contacts/${id}` }));

  const noDetails = scopedContacts
    .filter((ct) => !ct.email && !ct.phone)
    .map((ct) => ({ key: ct.id, label: contactName(ct), href: `/app/contacts/${ct.id}` }));

  const scopedIds = new Set(scopedContacts.map((ct) => ct.id));
  const reasonLabel = { email: "même e-mail", telephone: "même téléphone", nom: "même nom" } as const;
  const duplicates = duplicateGroups(
    data.contacts.map((ct) => ({ id: ct.id, firstName: ct.first_name, lastName: ct.last_name, email: ct.email, phone: ct.phone })),
  )
    .filter((g) => g.ids.some((id) => scopedIds.has(id)))
    .map((g) => ({ key: g.ids.join("-"), label: g.ids.map((id) => names.get(id)).join(" · "), href: `/app/contacts/${g.ids[0]}`, detail: `${reasonLabel[g.reason]} (${g.ids.length})` }));

  const scopedProperties = data.properties.filter((p) => mine(p.owner_user_id));
  const incomplete = scopedProperties
    .map((p) => ({ p, missing: [p.price === null && "prix", p.surface === null && "surface", p.rooms === null && "pièces"].filter(Boolean) as string[] }))
    .filter((x) => x.missing.length)
    .map(({ p, missing }) => ({ key: p.id, label: p.address_label, href: `/app/proprietes/${p.id}`, detail: `manque : ${missing.join(", ")}` }));

  const listings = scopedProperties
    .filter((p) => p.status === "mandat" || p.status === "sous_offre")
    .map((p) => {
      const m = /(\d{5})\s+(.+)$/.exec(p.address_label);
      const checks = checkListing({
        type: p.type, city: m?.[2] ?? p.address_label, postcode: m?.[1] ?? "", surface: p.surface, rooms: p.rooms, price: p.price,
        dpeClass: p.dpe_class as EnergyClass | null, gesClass: p.ges_class as EnergyClass | null,
        energyCostLow: p.energy_cost_low, energyCostHigh: p.energy_cost_high, energyCostYear: p.energy_cost_year,
        isCopro: p.is_copro, coproLots: p.copro_lots, coproAnnualCharges: p.copro_annual_charges, coproProcedure: p.copro_procedure,
        feesPayer: p.fees_payer, feesPercent: p.fees_percent, feeScheduleUrl: settings.feeScheduleUrl, title: null, description: null,
      });
      return { p, missing: checks.filter((x) => x.status === "manquante").length };
    })
    .filter((x) => x.missing > 0)
    .map(({ p, missing }) => ({ key: p.id, label: p.address_label, href: `/app/proprietes/${p.id}/annonce`, detail: `${missing} mention(s) manquante(s)` }));

  const broad = data.profiles
    .filter((pr) => mine(pr.owner_user_id) && pr.budget_max === null && pr.insee_codes.length === 0)
    .map((pr) => ({ key: pr.id, label: names.get(pr.contact_id) ?? "Acquéreur d'un collègue", href: `/app/contacts/${pr.contact_id}`, detail: "ni budget ni secteur" }));

  const lateDeals = deals
    .filter((d) => mine(d.owner_user_id))
    .flatMap((d) => dealDeadlines(d, today).filter((dl) => dl.daysLeft < 0).map((dl) => ({ d, dl })))
    .map(({ d, dl }) => ({ key: `${d.id}-${dl.key}`, label: d.property_label, href: `/app/affaires/${d.id}`, detail: `${dl.label} dépassée de ${-dl.daysLeft} j` }));

  const total = noConsent.length + noDetails.length + duplicates.length + incomplete.length + listings.length + broad.length + lateDeals.length;
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
      </div>
    </>
  );
}
