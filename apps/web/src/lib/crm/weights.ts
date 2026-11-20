/** Pondérations du matching lues depuis l'adresse de la page (formulaire GET « Ajuster »). */
import { DEFAULT_WEIGHTS, type CriterionKey, type Weights } from "@immopilot/domain";

export const WEIGHT_KEYS = Object.keys(DEFAULT_WEIGHTS) as CriterionKey[];

export function parseWeights(params: Partial<Record<string, string | string[] | undefined>>): { weights: Weights; custom: boolean } {
  const weights = { ...DEFAULT_WEIGHTS };
  let custom = false;
  for (const key of WEIGHT_KEYS) {
    const raw = params[`p_${key}`];
    const value = typeof raw === "string" && /^\d{1,3}$/.test(raw) ? Number(raw) : null;
    if (value !== null && value <= 100) {
      weights[key] = value;
      if (value !== DEFAULT_WEIGHTS[key]) custom = true;
    }
  }
  // Toutes les pondérations à zéro : aucun calcul possible, on revient aux valeurs par défaut.
  if (WEIGHT_KEYS.every((k) => weights[k] === 0)) return { weights: { ...DEFAULT_WEIGHTS }, custom: false };
  return { weights, custom };
}
