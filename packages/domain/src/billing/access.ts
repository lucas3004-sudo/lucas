/**
 * Accès au logiciel selon l'abonnement (D-057) : 14 jours d'essai gratuit à partir de la création
 * de l'agence, puis un abonnement payé est nécessaire. Un paiement en échec laisse 7 jours de grâce
 * (le temps de mettre à jour la carte) avant le blocage. Rien n'est jamais supprimé.
 */

export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 7;
const DAY = 86_400_000;

export type SubscriptionStatus = "actif" | "en_retard" | "annule";

export interface SubscriptionState {
  status: SubscriptionStatus;
  /** Fin de la période payée en cours (ou de la période de grâce en cas de retard). */
  currentPeriodEnd: Date | null;
  /** Date du premier échec de paiement (statut « en_retard »). */
  pastDueSince: Date | null;
}

export type Access =
  | { allowed: true; reason: "essai"; daysLeft: number; trialEndsAt: Date }
  | { allowed: true; reason: "abonnement" }
  | { allowed: true; reason: "paiement_en_retard"; daysLeft: number }
  | { allowed: false; reason: "essai_termine" | "abonnement_termine" | "paiement_echoue" };

export function trialEnd(agencyCreatedAt: Date): Date {
  return new Date(agencyCreatedAt.getTime() + TRIAL_DAYS * DAY);
}

export function accessFor(agencyCreatedAt: Date, sub: SubscriptionState | null, now = new Date()): Access {
  if (sub?.status === "actif" && (!sub.currentPeriodEnd || sub.currentPeriodEnd > now)) return { allowed: true, reason: "abonnement" };
  if (sub?.status === "en_retard") {
    const graceEnd = new Date((sub.pastDueSince ?? now).getTime() + GRACE_DAYS * DAY);
    if (graceEnd > now) return { allowed: true, reason: "paiement_en_retard", daysLeft: Math.ceil((graceEnd.getTime() - now.getTime()) / DAY) };
    return { allowed: false, reason: "paiement_echoue" };
  }
  // Pas d'abonnement payé : l'essai compte, même après une résiliation pendant l'essai.
  const end = trialEnd(agencyCreatedAt);
  if (end > now) return { allowed: true, reason: "essai", daysLeft: Math.ceil((end.getTime() - now.getTime()) / DAY), trialEndsAt: end };
  return { allowed: false, reason: sub ? "abonnement_termine" : "essai_termine" };
}

export const ACCESS_MESSAGES: Record<Exclude<Access, { allowed: true }>["reason"], string> = {
  essai_termine: "Votre essai gratuit de 14 jours est terminé. Choisissez une formule pour continuer : vos données sont conservées.",
  abonnement_termine: "Votre abonnement est terminé. Réabonnez-vous pour retrouver l'accès : vos données sont conservées.",
  paiement_echoue: "Le paiement de votre abonnement a échoué. Mettez à jour votre moyen de paiement pour retrouver l'accès.",
};
