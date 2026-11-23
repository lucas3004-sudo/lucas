/**
 * Abonnement de l'agence et droit d'accès (D-057). Lecture sous l'identité de l'utilisateur (RLS).
 */
import { withTenant } from "@immopilot/db";
import { accessFor, type Access, type SubscriptionState } from "@immopilot/domain";
import { cache } from "react";
import type { AgencyContext } from "../agency/context";
import { getTenantPool } from "../server/db";

export interface AgencySubscription extends SubscriptionState {
  plan: "investisseur" | "solo" | "pro" | "agency";
  extraSeats: number;
  stripeCustomerId: string | null;
}

export const agencySubscription = cache(async (ctx: AgencyContext): Promise<AgencySubscription | null> =>
  withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) => {
    const r = (await c.query("SELECT * FROM app.agency_subscriptions")).rows[0];
    return r
      ? {
          status: r.status, plan: r.plan, extraSeats: r.extra_seats, stripeCustomerId: r.stripe_customer_id,
          currentPeriodEnd: r.current_period_end, pastDueSince: r.past_due_since,
        }
      : null;
  }));

export async function agencyAccess(ctx: AgencyContext): Promise<{ access: Access; subscription: AgencySubscription | null }> {
  const subscription = await agencySubscription(ctx);
  return { access: accessFor(ctx.org.createdAt, subscription), subscription };
}
