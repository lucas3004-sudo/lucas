/**
 * Compte rendu de visite (F9, partie sans IA). Le texte destiné au vendeur est assemblé à partir
 * des réponses saisies, sans reformulation ni IA, et ne contient JAMAIS l'identité de l'acquéreur :
 * le vendeur n'a pas à la connaître à ce stade, et le compte rendu peut être transmis tel quel.
 */

export type VisitInterest = "fort" | "moyen" | "faible" | "aucun";
export type PriceOpinion = "coherent" | "eleve" | "trop_eleve" | "attractif";
export type VisitNextStep = "offre" | "seconde_visite" | "reflexion" | "abandon";

export const INTEREST_LABELS: Record<VisitInterest, string> = {
  fort: "Intérêt fort",
  moyen: "Intérêt moyen",
  faible: "Intérêt faible",
  aucun: "Pas d'intérêt",
};

export const PRICE_OPINION_LABELS: Record<PriceOpinion, string> = {
  attractif: "Prix jugé attractif",
  coherent: "Prix jugé cohérent",
  eleve: "Prix jugé un peu élevé",
  trop_eleve: "Prix jugé trop élevé",
};

export const NEXT_STEP_LABELS: Record<VisitNextStep, string> = {
  offre: "Envisage de faire une offre",
  seconde_visite: "Souhaite une seconde visite",
  reflexion: "Prend le temps de la réflexion",
  abandon: "Ne donne pas suite",
};

export interface VisitReportInput {
  interest: VisitInterest;
  priceOpinion: PriceOpinion | null;
  nextStep: VisitNextStep;
  positives: string | null;
  objections: string | null;
}

const SELLER_INTEREST: Record<VisitInterest, string> = {
  fort: "Les visiteurs se sont montrés très intéressés par votre bien.",
  moyen: "Les visiteurs se sont montrés intéressés par votre bien, avec quelques réserves.",
  faible: "Les visiteurs se sont montrés peu intéressés par votre bien.",
  aucun: "Le bien ne correspond pas à la recherche de ces visiteurs.",
};

const SELLER_PRICE: Record<PriceOpinion, string> = {
  attractif: "Ils trouvent le prix attractif.",
  coherent: "Ils trouvent le prix cohérent avec le bien.",
  eleve: "Ils trouvent le prix un peu élevé.",
  trop_eleve: "Ils trouvent le prix trop élevé.",
};

const SELLER_NEXT: Record<VisitNextStep, string> = {
  offre: "Ils envisagent de faire une offre : je vous tiendrai au courant dès que possible.",
  seconde_visite: "Ils souhaitent revenir pour une seconde visite : je vous propose des créneaux rapidement.",
  reflexion: "Ils prennent le temps de la réflexion : je reviens vers eux dans les prochains jours.",
  abandon: "Ils ne donneront pas suite.",
};

/** Ramène une saisie libre à une phrase propre (espaces, point final), ou null si vide. */
function sentence(text: string | null): string | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

/**
 * Texte du compte rendu pour le vendeur. `visitDate` est déjà formatée (« 21 novembre 2026 »).
 * Les champs libres sont repris tels que saisis : le négociateur reste responsable de leur contenu.
 */
export function sellerReportText(input: VisitReportInput, context: { visitDate: string; propertyLabel: string | null; agentName: string }): string {
  const lines = [
    "Bonjour,",
    "",
    `Voici le compte rendu de la visite du ${context.visitDate}${context.propertyLabel ? ` (${context.propertyLabel})` : ""}.`,
    "",
    SELLER_INTEREST[input.interest],
  ];
  const positives = sentence(input.positives);
  const objections = sentence(input.objections);
  if (positives) lines.push(`Points appréciés : ${positives}`);
  if (objections) lines.push(`Réserves exprimées : ${objections}`);
  if (input.priceOpinion) lines.push(SELLER_PRICE[input.priceOpinion]);
  lines.push(SELLER_NEXT[input.nextStep], "", "Bien cordialement,", context.agentName);
  return lines.join("\n");
}

export interface VisitStats {
  visits: number;
  byInterest: Record<VisitInterest, number>;
  offersConsidered: number;
  /** Réserve sur le prix (un peu élevé ou trop élevé), parmi les visites où un avis a été donné. */
  priceObjections: number;
  priceOpinions: number;
}

/** Synthèse des visites d'un bien (pour le responsable du bien et le vendeur). */
export function visitStats(reports: readonly Pick<VisitReportInput, "interest" | "priceOpinion" | "nextStep">[]): VisitStats {
  const byInterest: Record<VisitInterest, number> = { fort: 0, moyen: 0, faible: 0, aucun: 0 };
  let offersConsidered = 0;
  let priceObjections = 0;
  let priceOpinions = 0;
  for (const r of reports) {
    byInterest[r.interest] += 1;
    if (r.nextStep === "offre") offersConsidered += 1;
    if (r.priceOpinion) {
      priceOpinions += 1;
      if (r.priceOpinion === "eleve" || r.priceOpinion === "trop_eleve") priceObjections += 1;
    }
  }
  return { visits: reports.length, byInterest, offersConsidered, priceObjections, priceOpinions };
}
