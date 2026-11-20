/**
 * Statistiques descriptives. Fonctions pures.
 * Quartiles « inclusifs » (interpolation linéaire, comme QUARTILE.INCLUS d'un tableur
 * et statistics.quantiles(method="inclusive") du prototype Python) : les résultats
 * TypeScript et ceux du prototype sont donc comparables au centime près.
 */

export function quantileInclusive(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new Error("Série vide.");
  if (p < 0 || p > 1) throw new Error("Probabilité hors de [0 ; 1].");
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower]!;
  const high = sorted[upper]!;
  return low + (high - low) * (position - lower);
}

export interface Summary {
  count: number;
  q1: number;
  median: number;
  q3: number;
  /** (Q3 − Q1) / médiane : 0 = valeurs identiques ; plus c'est grand, plus elles sont dispersées. */
  dispersion: number;
}

export function summarize(values: readonly number[]): Summary {
  if (values.length === 0) throw new Error("Série vide.");
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantileInclusive(sorted, 0.25);
  const median = quantileInclusive(sorted, 0.5);
  const q3 = quantileInclusive(sorted, 0.75);
  return { count: sorted.length, q1, median, q3, dispersion: median === 0 ? 0 : (q3 - q1) / median };
}
