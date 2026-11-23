/**
 * Réglages de l'IA (D-063), lus côté serveur uniquement. Sans ANTHROPIC_API_KEY, l'IA est
 * éteinte : aucun appel, et les écrans l'indiquent clairement.
 */
export const aiConfig = () => ({
  enabled: Boolean(process.env.ANTHROPIC_API_KEY),
  // Haiku 5.5 : le modèle le moins cher d'Anthropic, suffisant pour l'aide et les questions courantes.
  model: process.env.AI_MODEL || "claude-haiku-5-5",
  // Plafond de dépenses global du mois, toutes agences confondues (dollars).
  monthlyBudgetMicroUsd: Math.round(Number(process.env.AI_MONTHLY_BUDGET_USD || "20") * 1_000_000),
});
