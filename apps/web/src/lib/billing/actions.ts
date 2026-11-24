"use server";
/** Paiement de l'abonnement (Stripe Checkout), gestion (portail Stripe), plafond des crédits IA. Gérant seulement. */
import { withTenant } from "@immopilot/db";
import { parseOverageCap } from "@immopilot/domain";
import { redirect } from "next/navigation";
import { requireAgency } from "../agency/context";
import { audit } from "../audit";
import { getTenantPool } from "../server/db";
import { appUrl } from "../server/env";
import { getStripe, isPaidPlan, priceLookupKey } from "./stripe";
import { agencyAccess } from "./subscription";

const DAY = 86_400_000;

export async function startCheckoutAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  if (ctx.role !== "gerant") redirect("/abonnement?erreur=gerant");
  const plan = String(form.get("plan") ?? "");
  if (!isPaidPlan(plan)) redirect("/abonnement");
  const stripe = getStripe();
  if (!stripe) redirect("/abonnement?erreur=indisponible");
  const price = (await stripe.prices.list({ lookup_keys: [priceLookupKey(plan)], active: true, limit: 1 })).data[0];
  if (!price) redirect("/abonnement?erreur=prix");
  const { access, subscription } = await agencyAccess(ctx);
  // Pendant l'essai : la carte est enregistrée maintenant, débitée seulement à la fin de l'essai.
  const trialEnd = access.allowed && access.reason === "essai" && access.trialEndsAt.getTime() - Date.now() > 2 * DAY
    ? Math.floor(access.trialEndsAt.getTime() / 1000)
    : undefined;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: price.id, quantity: 1 }],
    client_reference_id: ctx.org.id,
    ...(subscription?.stripeCustomerId ? { customer: subscription.stripeCustomerId } : { customer_email: ctx.user.email }),
    subscription_data: { metadata: { org_id: ctx.org.id, plan }, ...(trialEnd ? { trial_end: trialEnd } : {}) },
    metadata: { org_id: ctx.org.id, plan },
    locale: "fr",
    allow_promotion_codes: true,
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    success_url: `${appUrl()}/abonnement?statut=merci`,
    cancel_url: `${appUrl()}/abonnement`,
  });
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "abonnement.paiement_ouvert", details: { formule: plan } });
  if (!session.url) redirect("/abonnement?erreur=indisponible");
  redirect(session.url);
}

export async function openPortalAction(): Promise<void> {
  const ctx = await requireAgency();
  if (ctx.role !== "gerant") redirect("/abonnement?erreur=gerant");
  const stripe = getStripe();
  const { subscription } = await agencyAccess(ctx);
  if (!stripe || !subscription?.stripeCustomerId) redirect("/abonnement?erreur=indisponible");
  const portal = await stripe.billingPortal.sessions.create({ customer: subscription.stripeCustomerId, return_url: `${appUrl()}/abonnement`, locale: "fr" });
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "abonnement.portail_ouvert" });
  redirect(portal.url);
}

/** Plafond mensuel des crédits IA à l'usage (D-065) : gérant seulement, de 0 € (désactivé) à 500 €. */
export async function setOverageCapAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  if (ctx.role !== "gerant") redirect("/app/formule?plafond=gerant");
  const cents = parseOverageCap(String(form.get("plafond") ?? ""));
  if (cents === null) redirect("/app/formule?plafond=invalide");
  await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, (_db, c) =>
    c.query(
      `INSERT INTO app.agency_ai_settings (org_id, overage_cap_cents, updated_by) VALUES ($1, $2, $3)
       ON CONFLICT (org_id) DO UPDATE SET overage_cap_cents = EXCLUDED.overage_cap_cents, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [ctx.org.id, cents, ctx.user.id],
    ));
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "ia.plafond_modifie", details: { plafond_eur: cents / 100 } });
  redirect("/app/formule?plafond=ok");
}
