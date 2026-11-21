/**
 * Rapport de qualité des données (page « Qualité des données » et agent du même nom).
 * Lectures sous l'identité de l'utilisateur : la RLS s'applique. Signale, ne corrige jamais.
 */
import { withTenant } from "@immopilot/db";
import { checkListing, contactsWithoutValidConsent, duplicateGroups, mandateAlert, mandateAlertLabel, utcToParisLocal, type EnergyClass } from "@immopilot/domain";
import type { AgencyContext } from "../agency/context";
import { getAgencySettings } from "../agency/settings";
import { contactName, toProperty } from "../crm/data";
import { MATCHABLE_STATUSES } from "../crm/labels";
import { listDeals } from "../deals/data";
import { dealDeadlines } from "../deals/deadlines";
import { getTenantPool } from "../server/db";

export type QualityItem = { key: string; label: string; href: string; detail?: string };

export interface QualityReport {
  noConsent: QualityItem[];
  duplicates: QualityItem[];
  listings: QualityItem[];
  incomplete: QualityItem[];
  lateDeals: QualityItem[];
  broad: QualityItem[];
  noDetails: QualityItem[];
  expiredMandates: QualityItem[];
}

/** scopeAll : toute l'agence (gérant, manager) ; sinon, les éléments dont l'utilisateur est responsable. */
export async function qualityReport(ctx: AgencyContext, scopeAll: boolean): Promise<QualityReport> {
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
      properties: (await c.query("SELECT * FROM app.properties WHERE status = ANY($1)", [MATCHABLE_STATUSES])).rows.map(toProperty),
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

  const expiredMandates = scopedProperties
    .map((p) => ({ p, alert: mandateAlert({ status: p.status, mandateEndsOn: p.mandate_ends_on }, today) }))
    .filter((x) => x.alert?.kind === "expire")
    .map(({ p, alert }) => ({ key: p.id, label: p.address_label, href: `/app/proprietes/${p.id}`, detail: mandateAlertLabel(alert!) }));

  return { noConsent, duplicates, listings, incomplete, lateDeals, broad, noDetails, expiredMandates };
}

export function qualityCounts(r: QualityReport): Record<string, number> {
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, (v as QualityItem[]).length]));
}
