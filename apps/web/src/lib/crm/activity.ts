/**
 * Activité d'un bien (D-061) : historique noté par la base (mise en vente, prix, statut,
 * mandat), visites et leurs comptes rendus, acquéreurs de l'agence qui correspondent, affaires.
 * Tout est lu sous RLS : chacun ne voit que ce que ses droits permettent.
 */
import { withTenant } from "@immopilot/db";
import { listingHistory, matchProperty, visitStats, type PropertyEvent, type PropertyEventKind } from "@immopilot/domain";
import type { AgencyContext } from "../agency/context";
import { listDeals } from "../deals/data";
import { getTenantPool } from "../server/db";
import { reportsForProperty } from "../visits/data";
import { ALERT_THRESHOLD } from "./alerts";
import { activeProfiles, asMatchProfile, asMatchProperty, type Property } from "./data";
import { MATCHABLE_STATUSES } from "./labels";

export async function propertyEvents(ctx: AgencyContext, propertyId: string): Promise<PropertyEvent[]> {
  return withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    (await c.query<{ kind: PropertyEventKind; old_value: string | null; new_value: string | null; created_at: Date }>(
      `SELECT e.kind, e.old_value, e.new_value, e.created_at FROM app.property_events e
       WHERE e.property_id = $1 ORDER BY e.created_at, e.id LIMIT 200`,
      [propertyId],
    )).rows.map((r) => ({ kind: r.kind, oldValue: r.old_value, newValue: r.new_value, at: r.created_at })));
}

export async function propertyActivity(ctx: AgencyContext, property: Property) {
  const matchable = MATCHABLE_STATUSES.includes(property.status);
  const [events, reports, profiles, deals] = await Promise.all([
    propertyEvents(ctx, property.id),
    reportsForProperty(ctx, property.id),
    matchable ? activeProfiles(ctx) : Promise.resolve([]),
    listDeals(ctx, { propertyId: property.id }),
  ]);
  const history = listingHistory(events, property.status, property.price);
  const visits = visitStats(reports.map((r) => ({ interest: r.interest, priceOpinion: r.price_opinion, nextStep: r.next_step })));
  const target = asMatchProperty(property);
  const interested = profiles.filter((p) => {
    const r = matchProperty(target, asMatchProfile(p));
    return r.compatible && r.score >= ALERT_THRESHOLD;
  }).length;
  return { events, history, visits, interested, deals };
}
