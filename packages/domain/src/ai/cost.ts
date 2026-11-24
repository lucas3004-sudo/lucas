/**
 * Coût et garde-fous de l'IA (D-063). Prix publics d'Anthropic, en dollars par million de jetons
 * (tarifs vérifiés le 23/11/2026 ; à revoir si Anthropic les change). Le coût de chaque appel est
 * enregistré en micro-dollars ; un appel n'est autorisé que si l'IA est activée, que le quota de
 * la formule n'est pas atteint et que le plafond de dépenses global du mois n'est pas dépassé.
 */

interface Price {
  input: number;
  output: number;
  /** Au-delà de ce nombre de jetons en entrée, un autre tarif s'applique (Haiku 5.5). */
  longPromptAbove?: number;
  longInput?: number;
  longOutput?: number;
}

export const AI_PRICES_USD_PER_MTOK: Record<string, Price> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, longPromptAbove: 100_000, longInput: 0.5, longOutput: 2.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

/** Coût d'un appel en micro-dollars (arrondi au supérieur). Modèle inconnu : tarif le plus cher, par prudence. */
export function aiCostMicroUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = AI_PRICES_USD_PER_MTOK[model] ?? AI_PRICES_USD_PER_MTOK["claude-opus-5-5"]!;
  const long = p.longPromptAbove !== undefined && inputTokens > p.longPromptAbove;
  const inPrice = long ? p.longInput! : p.input;
  const outPrice = long ? p.longOutput! : p.output;
  // prix par million de jetons × jetons = micro-dollars
  return Math.ceil(inputTokens * inPrice + outputTokens * outPrice);
}

export type AiGateReason = "desactivee" | "lecture_seule" | "non_inclus" | "quota_atteint" | "plafond_atteint" | "budget_atteint";

export interface AiGateInput {
  enabled: boolean;
  role: string;
  /** Quota mensuel de la formule : null = illimité, 0 = non inclus. */
  limit: number | null;
  used: number;
  budgetLeft: boolean;
  /**
   * Crédits à l'usage (D-065) : au-delà du quota, l'appel est permis s'il est facturable (agence
   * abonnée) et que le plafond du gérant n'est pas atteint. Absent : pas de dépassement possible.
   */
  overage?: { billable: boolean; capCents: number; spentCents: number; unitCents: number };
}

export interface AiDecision {
  reason: AiGateReason | null;
  /** L'appel sera facturé à l'usage (au-delà du quota de la formule). */
  overage: boolean;
}

/** Peut-on lancer un appel à l'IA, et sera-t-il facturé à l'usage ? */
export function aiDecision(g: AiGateInput): AiDecision {
  const refuse = (reason: AiGateReason): AiDecision => ({ reason, overage: false });
  if (!g.enabled) return refuse("desactivee");
  if (g.role === "lecture") return refuse("lecture_seule");
  if (g.limit === 0) return refuse("non_inclus");
  let overage = false;
  if (g.limit !== null && g.used >= g.limit) {
    if (!g.overage?.billable || g.overage.capCents <= 0) return refuse("quota_atteint");
    if (g.overage.spentCents + g.overage.unitCents > g.overage.capCents) return refuse("plafond_atteint");
    overage = true;
  }
  if (!g.budgetLeft) return refuse("budget_atteint");
  return { reason: null, overage };
}

/** Peut-on lancer un appel à l'IA ? Renvoie null si oui, sinon la raison du refus. */
export function aiGate(g: AiGateInput): AiGateReason | null {
  return aiDecision(g).reason;
}

export const AI_GATE_MESSAGES: Record<AiGateReason, string> = {
  desactivee: "L'assistant IA n'est pas encore activé. Il le sera très bientôt.",
  lecture_seule: "Votre rôle (lecture seule) ne permet pas d'utiliser l'assistant IA.",
  non_inclus: "L'assistant IA n'est pas inclus dans la formule actuelle de l'agence.",
  quota_atteint:
    "Les échanges inclus dans la formule sont épuisés ce mois-ci (ils repartent à zéro le 1er du mois). Pour continuer, le gérant peut activer les crédits à l'usage dans « Formule » : 2 € les 100 échanges, avec un abonnement payant.",
  plafond_atteint: "Le plafond de crédits à l'usage fixé par le gérant est atteint pour ce mois-ci. Il peut le relever dans « Formule ».",
  budget_atteint: "L'assistant IA est momentanément indisponible. Réessayez plus tard.",
};
