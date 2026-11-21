/**
 * Formules et quotas (grille validée par le fondateur, D-014 ; coûts IA, phase 1 section 2.2).
 * Règle de rentabilité (D-047) : chaque formule plafonne les usages qui coûtent (IA) ; au quota,
 * l'action est refusée avec un message clair, jamais facturée en douce.
 * « null » = illimité.
 */

export type PlanId = "essai" | "investisseur" | "solo" | "pro" | "agency";
export type QuotaMetric = "dossiers" | "copilot" | "annonces_ia" | "contacts" | "membres";

export interface Plan {
  id: PlanId;
  name: string;
  /** Prix HT mensuel en euros (null : gratuit). */
  priceEur: number | null;
  /** Prix par membre au-delà des membres inclus (Agency). */
  extraSeatEur: number | null;
  quotas: Record<QuotaMetric, number | null>;
  /** Usages mensuels (remis à zéro chaque mois) ; les autres sont des stocks (contacts, membres). */
  description: string;
}

export const MONTHLY_METRICS: readonly QuotaMetric[] = ["dossiers", "copilot", "annonces_ia"];

export const PLANS: Record<PlanId, Plan> = {
  essai: {
    id: "essai",
    name: "Essai (préproduction)",
    priceEur: null,
    extraSeatEur: null,
    quotas: { dossiers: 30, copilot: 0, annonces_ia: 0, contacts: 500, membres: 5 },
    description: "Toutes les fonctions sans IA, pour découvrir le produit. Aucun paiement.",
  },
  investisseur: {
    id: "investisseur",
    name: "Investisseur",
    priceEur: 19,
    extraSeatEur: null,
    quotas: { dossiers: 10, copilot: 50, annonces_ia: 0, contacts: 100, membres: 1 },
    description: "Dossiers de biens et Investment Studio illimité.",
  },
  solo: {
    id: "solo",
    name: "Solo",
    priceEur: 59,
    extraSeatEur: null,
    quotas: { dossiers: 40, copilot: 200, annonces_ia: 30, contacts: 1000, membres: 1 },
    description: "Un utilisateur.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceEur: 99,
    extraSeatEur: null,
    quotas: { dossiers: 100, copilot: 500, annonces_ia: 80, contacts: 5000, membres: 1 },
    description: "Un utilisateur, PDF à votre marque.",
  },
  agency: {
    id: "agency",
    name: "Agency",
    priceEur: 249,
    extraSeatEur: 49,
    quotas: { dossiers: 250, copilot: 1200, annonces_ia: 200, contacts: null, membres: 3 },
    description: "Trois utilisateurs inclus (49 € par utilisateur supplémentaire), quotas partagés, rôles.",
  },
};

export const METRIC_LABELS: Record<QuotaMetric, string> = {
  dossiers: "Dossiers de biens ce mois-ci",
  copilot: "Échanges avec le Copilot ce mois-ci",
  annonces_ia: "Annonces rédigées par IA ce mois-ci",
  contacts: "Contacts",
  membres: "Membres de l'agence",
};

export function isPlanId(value: string): value is PlanId {
  return value in PLANS;
}

export interface QuotaCheck {
  allowed: boolean;
  used: number;
  limit: number | null;
  /** null : illimité. */
  remaining: number | null;
}

/** Peut-on ajouter `adding` unités ? (Agency : membres inclus + membres supplémentaires payés.) */
export function checkQuota(plan: Plan, metric: QuotaMetric, used: number, adding = 1, extraSeats = 0): QuotaCheck {
  const base = plan.quotas[metric];
  const limit = base === null ? null : metric === "membres" && plan.extraSeatEur !== null ? base + Math.max(0, extraSeats) : base;
  if (limit === null) return { allowed: true, used, limit: null, remaining: null };
  return { allowed: used + adding <= limit, used, limit, remaining: Math.max(0, limit - used) };
}

export function quotaMessage(plan: Plan, metric: QuotaMetric, check: QuotaCheck): string {
  if (check.limit === 0) return `${METRIC_LABELS[metric]} : non inclus dans la formule ${plan.name}.`;
  return `Quota atteint pour la formule ${plan.name} : ${METRIC_LABELS[metric].toLowerCase()} (${check.used} sur ${check.limit}).${
    MONTHLY_METRICS.includes(metric) ? " Le compteur repart à zéro le 1er du mois." : ""
  }`;
}

/** Prix mensuel HT d'une formule, membres supplémentaires compris. */
export function monthlyPrice(plan: Plan, extraSeats = 0): number | null {
  if (plan.priceEur === null) return null;
  return plan.priceEur + (plan.extraSeatEur ?? 0) * Math.max(0, extraSeats);
}
