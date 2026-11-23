/**
 * Chiffres du récap (D-062), comptés sous RLS : chacun voit le récap de ce qu'il a le droit de
 * voir (les éléments privés d'un collègue ne sont ni montrés ni comptés).
 */
import { withTenant } from "@immopilot/db";
import type { RecapCounts, RecapPeriod } from "@immopilot/domain";
import type { AgencyContext } from "../agency/context";
import { getTenantPool } from "../server/db";

const SINCE: Record<RecapPeriod, string> = { jour: "24 hours", semaine: "7 days" };

export interface PriceDrop {
  propertyId: string;
  label: string;
  from: number;
  to: number;
}

export async function recapData(ctx: AgencyContext, period: RecapPeriod): Promise<{ counts: RecapCounts; priceDrops: PriceDrop[] }> {
  return withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) => {
    const since = SINCE[period];
    const row = (await c.query<Record<string, string>>(
      `WITH s AS (SELECT now() - $1::interval AS start, (now() AT TIME ZONE 'Europe/Paris')::date AS today)
       SELECT
         (SELECT count(*) FROM app.properties p, s WHERE p.created_at >= s.start) AS new_properties,
         (SELECT count(*) FROM app.property_events e, s WHERE e.kind = 'prix' AND e.created_at >= s.start
            AND CASE WHEN e.kind = 'prix' THEN e.new_value::bigint < e.old_value::bigint END) AS price_drops,
         (SELECT count(*) FROM app.property_events e, s WHERE e.kind = 'statut' AND e.new_value = 'sous_offre' AND e.created_at >= s.start) AS under_offer,
         (SELECT count(*) FROM app.property_events e, s WHERE e.kind = 'statut' AND e.new_value = 'vendu' AND e.created_at >= s.start) AS sold,
         (SELECT count(*) FROM app.contacts ct, s WHERE ct.created_at >= s.start) AS new_contacts,
         (SELECT count(*) FROM app.buyer_profiles bp, s WHERE bp.created_at >= s.start) AS new_buyer_profiles,
         (SELECT count(*) FROM app.appointments a, s WHERE a.kind = 'visite' AND a.status = 'prevu' AND a.starts_at >= s.start AND a.starts_at < now()) AS visits_done,
         (SELECT count(*) FROM app.visit_reports vr, s WHERE vr.interest = 'fort' AND vr.created_at >= s.start) AS strong_interest,
         (SELECT count(*) FROM app.appointments a WHERE a.kind = 'visite' AND a.status = 'prevu' AND a.starts_at >= now() AND a.starts_at < now() + interval '7 days') AS upcoming_visits,
         (SELECT count(*) FROM app.deals d, s WHERE d.created_at >= s.start) AS new_deals,
         (SELECT count(*) FROM app.deals d, s WHERE d.stage = 'acte' AND d.updated_at >= s.start) AS deeds,
         (SELECT count(*) FROM app.tasks t, s WHERE t.done_at >= s.start) AS tasks_done,
         (SELECT count(*) FROM app.tasks t, s WHERE t.status = 'a_faire' AND t.due_on < s.today) AS tasks_overdue,
         (SELECT count(*) FROM app.approvals ap WHERE ap.status = 'en_attente') AS approvals_pending,
         (SELECT count(*) FROM app.properties p, s WHERE p.status IN ('mandat', 'sous_offre') AND p.mandate_ends_on BETWEEN s.today AND s.today + 30) AS mandates_ending`,
      [since],
    )).rows[0]!;
    const n = (k: string) => Number(row[k] ?? 0);
    const counts: RecapCounts = {
      newProperties: n("new_properties"), priceDrops: n("price_drops"), underOffer: n("under_offer"), sold: n("sold"),
      newContacts: n("new_contacts"), newBuyerProfiles: n("new_buyer_profiles"), visitsDone: n("visits_done"),
      strongInterest: n("strong_interest"), upcomingVisits: n("upcoming_visits"), newDeals: n("new_deals"), deeds: n("deeds"),
      tasksDone: n("tasks_done"), tasksOverdue: n("tasks_overdue"), approvalsPending: n("approvals_pending"), mandatesEndingSoon: n("mandates_ending"),
    };
    const priceDrops = (await c.query<{ property_id: string; address_label: string; old_value: string; new_value: string }>(
      `SELECT e.property_id, p.address_label, e.old_value, e.new_value
       FROM app.property_events e JOIN app.properties p ON p.id = e.property_id
       WHERE e.kind = 'prix' AND e.created_at >= now() - $1::interval
         AND CASE WHEN e.kind = 'prix' THEN e.new_value::bigint < e.old_value::bigint END
       ORDER BY e.created_at DESC LIMIT 5`,
      [since],
    )).rows.map((r) => ({ propertyId: r.property_id, label: r.address_label, from: Number(r.old_value), to: Number(r.new_value) }));
    return { counts, priceDrops };
  });
}
