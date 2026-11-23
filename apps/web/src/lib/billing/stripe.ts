/**
 * Paiement par Stripe (D-057). Activé seulement si STRIPE_SECRET_KEY est configurée (clé de
 * test d'abord). Les prix sont retrouvés par leur « lookup key » (immopilot_<formule>_mensuel),
 * créés une fois dans Stripe : aucun identifiant de prix codé en dur.
 */
import type { PlanId } from "@immopilot/domain";
import Stripe from "stripe";

export const PAID_PLANS = ["investisseur", "solo", "pro", "agency"] as const satisfies readonly PlanId[];
export type PaidPlan = (typeof PAID_PLANS)[number];
export const priceLookupKey = (plan: PaidPlan) => `immopilot_${plan}_mensuel`;

let client: Stripe | null = null;
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key, { appInfo: { name: "ImmoPilot" } });
  return client;
}

export function isPaidPlan(v: string): v is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(v);
}

/** Statut Stripe → statut ImmoPilot (null : rien à enregistrer, ex. paiement initial incomplet). */
export function mapStatus(status: Stripe.Subscription.Status): "actif" | "en_retard" | "annule" | null {
  if (status === "active" || status === "trialing") return "actif";
  if (status === "past_due" || status === "unpaid") return "en_retard";
  if (status === "canceled" || status === "incomplete_expired") return "annule";
  return null;
}

/** Données à enregistrer pour un abonnement Stripe (la formule vient de la clé du prix). */
export function subscriptionRecord(sub: Stripe.Subscription): {
  orgId: string; status: "actif" | "en_retard" | "annule"; plan: PaidPlan; customer: string; subscription: string; periodEnd: Date | null;
} | null {
  const orgId = sub.metadata?.org_id;
  const status = mapStatus(sub.status);
  const item = sub.items.data[0];
  const key = item?.price.lookup_key ?? "";
  const plan = /^immopilot_(investisseur|solo|pro|agency)_mensuel$/.exec(key)?.[1];
  if (!orgId || !status || !plan || !isPaidPlan(plan)) return null;
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  return { orgId, status, plan, customer, subscription: sub.id, periodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null };
}
