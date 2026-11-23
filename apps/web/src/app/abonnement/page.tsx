/**
 * Abonnement de l'agence (D-057) : état de l'essai ou de l'abonnement, choix de la formule
 * (paiement Stripe), gestion (factures, carte, résiliation). Accessible même quand l'accès au
 * logiciel est bloqué, pour pouvoir payer.
 */
import { ACCESS_MESSAGES, METRIC_LABELS, monthlyPrice, PLANS } from "@immopilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/agency/context";
import { openPortalAction, startCheckoutAction } from "@/lib/billing/actions";
import { getStripe, PAID_PLANS } from "@/lib/billing/stripe";
import { agencyAccess } from "@/lib/billing/subscription";
import { fmt } from "@/lib/format";
import { buttonClass } from "@/ui/button";
import { SubmitButton } from "@/ui/client";
import { Logo } from "@/ui/logo";
import { Alert, Badge, Card, CardBody } from "@/ui/surface";

export const metadata: Metadata = { title: "Abonnement" };

const ERRORS: Record<string, string> = {
  gerant: "Seul le gérant de l'agence peut choisir ou modifier l'abonnement.",
  indisponible: "Le paiement en ligne n'est pas encore activé. Réessayez plus tard.",
  prix: "Cette formule n'est pas encore disponible au paiement.",
};
const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ statut?: string; erreur?: string }> }) {
  const ctx = await requireAgency();
  const sp = await searchParams;
  const { access, subscription } = await agencyAccess(ctx);
  const paymentReady = Boolean(getStripe());
  const isManager = ctx.role === "gerant";

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-4">
        <Logo />
        {access.allowed ? <Link href="/app" className={buttonClass("secondary", "sm")}>Retour au logiciel</Link> : null}
      </header>
      <main id="contenu" className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Abonnement de {ctx.org.name}</h1>
        <div className="mt-4 space-y-3">
          {sp.statut === "merci" ? <Alert tone="success">Merci ! Votre abonnement est en cours d&apos;activation : cela prend quelques secondes.</Alert> : null}
          {sp.erreur && ERRORS[sp.erreur] ? <Alert tone="danger">{ERRORS[sp.erreur]}</Alert> : null}
          {!access.allowed ? <Alert tone="warning">{ACCESS_MESSAGES[access.reason]}</Alert> : null}
          {access.allowed && access.reason === "essai" ? (
            <Alert tone="brand">
              Essai gratuit : {access.daysLeft} jour(s) restant(s), jusqu&apos;au {dateFmt.format(access.trialEndsAt)}.
              Choisissez une formule maintenant : votre carte ne sera débitée qu&apos;à la fin de l&apos;essai.
            </Alert>
          ) : null}
          {access.allowed && access.reason === "paiement_en_retard" ? (
            <Alert tone="warning">Le dernier paiement a échoué : mettez à jour votre carte sous {access.daysLeft} jour(s) pour garder l&apos;accès.</Alert>
          ) : null}
          {subscription && subscription.status !== "annule" ? (
            <Card>
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-ink-muted">Formule actuelle</p>
                  <p className="text-lg font-semibold text-ink">{PLANS[subscription.plan].name}</p>
                  {subscription.currentPeriodEnd ? <p className="text-sm text-ink-muted">Prochaine échéance : {dateFmt.format(subscription.currentPeriodEnd)}</p> : null}
                </div>
                {isManager && subscription.stripeCustomerId && paymentReady ? (
                  <form action={openPortalAction}>
                    <SubmitButton variant="secondary">Gérer l&apos;abonnement (factures, carte, résiliation)</SubmitButton>
                  </form>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
          {!paymentReady ? <Alert tone="brand">Le paiement en ligne est en cours d&apos;activation.</Alert> : null}
          {!isManager ? <Alert tone="brand">Seul le gérant de l&apos;agence peut choisir la formule.</Alert> : null}
        </div>

        <h2 className="mt-10 text-xl font-semibold text-ink">Les formules</h2>
        <p className="mt-1 text-sm text-ink-muted">Prix hors taxes, par mois, sans engagement. Résiliable à tout moment.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PAID_PLANS.map((id) => {
            const plan = PLANS[id];
            const current = subscription?.status !== "annule" && subscription?.plan === id;
            return (
              <Card key={id} className={current ? "ring-2 ring-brand" : ""}>
                <CardBody className="flex h-full flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
                    {id === "agency" ? <Badge tone="brand">Équipes</Badge> : null}
                  </div>
                  <p>
                    <span className="text-3xl font-semibold tracking-tight text-ink">{fmt.euros(monthlyPrice(plan) ?? 0)}</span>
                    <span className="text-sm text-ink-muted"> HT / mois</span>
                  </p>
                  <p className="text-sm text-ink-muted">{plan.description}</p>
                  <ul className="flex-1 space-y-1.5 text-sm text-ink">
                    {(Object.keys(plan.quotas) as (keyof typeof plan.quotas)[]).map((m) => (
                      <li key={m} className="flex justify-between gap-2">
                        <span className="text-ink-muted">{METRIC_LABELS[m].replace(" ce mois-ci", "")}</span>
                        <span className="font-medium">{plan.quotas[m] === null ? "Illimité" : plan.quotas[m] === 0 ? "—" : fmt.number(plan.quotas[m]!)}</span>
                      </li>
                    ))}
                  </ul>
                  {current ? (
                    <p className="text-sm font-medium text-brand-text">Votre formule</p>
                  ) : (
                    <form action={startCheckoutAction}>
                      <input type="hidden" name="plan" value={id} />
                      <SubmitButton className="w-full" disabled={!paymentReady || !isManager} pendingLabel="Ouverture du paiement…">
                        Choisir {plan.name}
                      </SubmitButton>
                    </form>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
        <p className="mt-6 text-xs text-ink-muted">
          Paiement sécurisé par Stripe : ImmoPilot ne voit ni ne conserve vos numéros de carte. Vos données restent conservées même si l&apos;abonnement s&apos;arrête.
        </p>
      </main>
    </div>
  );
}
