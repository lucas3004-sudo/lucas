/**
 * Événements Stripe (abonnements, factures). La signature est vérifiée avec STRIPE_WEBHOOK_SECRET
 * avant tout traitement ; l'abonnement est alors enregistré par app.apply_subscription (migration
 * 0020), et les crédits IA à l'usage sont ajoutés à la facture de renouvellement (D-065).
 */
import { overageInvoiceLine } from "@immopilot/domain";
import type Stripe from "stripe";
import { getStripe, overageInvoiceTarget, subscriptionRecord } from "@/lib/billing/stripe";
import { getTenantPool } from "@/lib/server/db";

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return Response.json({ error: "Paiement non configuré." }, { status: 503 });
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return Response.json({ error: "Signature invalide." }, { status: 400 });
  }
  if (event.type === "invoice.created") {
    const target = overageInvoiceTarget(event.data.object);
    if (!target) return Response.json({ received: true, credits: 0 });
    const row = (await getTenantPool().query<{ org_id: string; copilot: number; annonces: number; cents: string }>(
      "SELECT * FROM app.ai_overage_for_customer($1, $2, $3)", [target.customer, target.from, target.to],
    )).rows[0];
    const line = row ? overageInvoiceLine({ copilot: row.copilot, annonces: row.annonces, cents: Number(row.cents) }) : null;
    if (row && line) {
      // Clé d'idempotence : un événement renvoyé par Stripe n'ajoute pas la ligne deux fois.
      await stripe.invoiceItems.create(
        { customer: target.customer, invoice: target.invoiceId, amount: line.cents, currency: "eur", description: line.description, metadata: { org_id: row.org_id, immopilot: "credits_ia" } },
        { idempotencyKey: `credits-ia-${target.invoiceId}` },
      );
    }
    return Response.json({ received: true, credits: line?.cents ?? 0 });
  }

  let subscription: Stripe.Subscription | null = null;
  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    subscription = event.data.object;
  } else if (event.type === "checkout.session.completed" && event.data.object.subscription) {
    const id = event.data.object.subscription;
    subscription = await stripe.subscriptions.retrieve(typeof id === "string" ? id : id.id);
  }
  const record = subscription ? subscriptionRecord(subscription) : null;
  if (record) {
    await getTenantPool().query("SELECT app.apply_subscription($1, $2, $3, 0, $4, $5, $6)", [
      record.orgId, record.status, record.plan, record.customer, record.subscription, record.periodEnd,
    ]);
  }
  return Response.json({ received: true, applied: Boolean(record) });
}
