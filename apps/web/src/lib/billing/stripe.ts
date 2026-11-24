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

const PLAN_KEY = /^immopilot_(investisseur|solo|pro|agency)_mensuel$/;

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
  // L'élément de la formule (d'autres éléments pourraient s'ajouter un jour sur l'abonnement).
  const item = sub.items.data.find((i) => PLAN_KEY.test(i.price.lookup_key ?? ""));
  const plan = PLAN_KEY.exec(item?.price.lookup_key ?? "")?.[1];
  if (!orgId || !status || !plan || !isPaidPlan(plan)) return null;
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  return { orgId, status, plan, customer, subscription: sub.id, periodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null };
}

/**
 * Facture de renouvellement à compléter avec les crédits IA consommés pendant la période écoulée
 * (D-065). Stripe envoie « invoice.created » environ une heure avant de la finaliser : on peut alors
 * y ajouter une ligne. Seules les factures de cycle (pas la première) sont concernées.
 */
export function overageInvoiceTarget(invoice: Stripe.Invoice): { invoiceId: string; customer: string; from: Date; to: Date } | null {
  if (invoice.status !== "draft" || invoice.billing_reason !== "subscription_cycle" || !invoice.id) return null;
  const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customer || invoice.currency !== "eur" || invoice.period_end <= invoice.period_start) return null;
  return { invoiceId: invoice.id, customer, from: new Date(invoice.period_start * 1000), to: new Date(invoice.period_end * 1000) };
}
