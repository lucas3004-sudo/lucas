/**
 * Crédits IA à l'usage de l'agence (D-065) : facturables seulement pour une agence abonnée par
 * Stripe (il faut un moyen de paiement), dans la limite du plafond choisi par le gérant.
 */
import { withTenant } from "@immopilot/db";
import { DEFAULT_OVERAGE_CAP_CENTS, parisMonthStart, type OverageUsage } from "@immopilot/domain";
import type { AgencyContext } from "../agency/context";
import { getTenantPool } from "../server/db";
import { getStripe } from "./stripe";
import { agencySubscription } from "./subscription";

export interface OverageState {
  /** L'agence peut être facturée à l'usage (abonnement actif avec un client Stripe). */
  billable: boolean;
  capCents: number;
  /** Le plafond vient du réglage par défaut (le gérant ne l'a jamais modifié). */
  defaultCap: boolean;
  /** Crédits consommés ce mois-ci (heure de Paris), par toute l'agence. */
  month: OverageUsage;
}

export async function overageState(ctx: AgencyContext, now = new Date()): Promise<OverageState> {
  const subscription = await agencySubscription(ctx);
  const billable = Boolean(getStripe() && subscription?.status === "actif" && subscription.stripeCustomerId);
  return withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) => {
    const setting = (await c.query<{ overage_cap_cents: number }>("SELECT overage_cap_cents FROM app.agency_ai_settings")).rows[0];
    const month = (await c.query<{ copilot: number; annonces: number; cents: string }>("SELECT * FROM app.ai_overage($1)", [parisMonthStart(now)])).rows[0];
    return {
      billable,
      capCents: setting?.overage_cap_cents ?? DEFAULT_OVERAGE_CAP_CENTS,
      defaultCap: !setting,
      month: { copilot: month?.copilot ?? 0, annonces: month?.annonces ?? 0, cents: Number(month?.cents ?? 0) },
    };
  });
}
