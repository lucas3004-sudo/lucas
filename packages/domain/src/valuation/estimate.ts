/**
 * Estimation indicative d'un bien à partir de ventes comparables (DVF nettoyées).
 * docs/phase-2/ingestion.md, section 3 ; critère d'acceptation F3 :
 *   - toujours une FOURCHETTE, jamais un prix unique ;
 *   - un niveau de confiance calculé à partir du nombre et de la dispersion des comparables ;
 *   - en dessous de MIN_COMPARABLES, aucune estimation (« données insuffisantes »).
 * Ce n'est pas une expertise : la mention est imposée par l'interface et les validateurs.
 */
import { summarize, type Summary } from "../stats";

export type Confidence = "elevee" | "moyenne" | "faible";

export const RADIUS_STEPS_M = [500, 1000, 2000, 3000] as const;
export const TARGET_COMPARABLES = 10;
export const MIN_COMPARABLES = 3;
export const LOOKBACK_MONTHS = 24;
export const SURFACE_RATIO = { min: 0.5, max: 1.5 } as const;

export interface Comparable {
  mutationId: string;
  date: string;
  price: number;
  surface: number;
  pricePerSqm: number;
  distanceM: number;
}

export function withinSurfaceRange(subjectSurface: number, comparableSurface: number): boolean {
  return comparableSurface >= subjectSurface * SURFACE_RATIO.min && comparableSurface <= subjectSurface * SURFACE_RATIO.max;
}

export function confidenceLevel(count: number, dispersion: number): Confidence {
  if (count < 8 || dispersion > 0.5) return "faible";
  if (count >= 20 && dispersion < 0.3) return "elevee";
  return "moyenne";
}

/** Arrondi à 1 000 € près : une précision plus fine serait trompeuse. */
export function roundEuros(value: number, step = 1000): number {
  return Math.round(value / step) * step;
}

export type Estimate =
  | {
      status: "ok";
      subjectSurface: number;
      comparables: number;
      stats: Summary;
      low: number;
      mid: number;
      high: number;
      confidence: Confidence;
    }
  | { status: "insuffisant"; comparables: number; minimum: number };

export function estimateRange(subjectSurface: number, comparables: readonly Comparable[]): Estimate {
  if (!(subjectSurface > 0)) throw new Error("Surface du bien invalide.");
  if (comparables.length < MIN_COMPARABLES) {
    return { status: "insuffisant", comparables: comparables.length, minimum: MIN_COMPARABLES };
  }
  const stats = summarize(comparables.map((c) => c.pricePerSqm));
  return {
    status: "ok",
    subjectSurface,
    comparables: stats.count,
    stats,
    low: roundEuros(stats.q1 * subjectSurface),
    mid: roundEuros(stats.median * subjectSurface),
    high: roundEuros(stats.q3 * subjectSurface),
    confidence: confidenceLevel(stats.count, stats.dispersion),
  };
}

/** Date de début de la fenêtre de recherche, comptée depuis la vente la plus récente du millésime (DVF a ~6 mois de retard). */
export function lookbackStart(latestSaleDate: string, months = LOOKBACK_MONTHS): string {
  const [y, m, d] = latestSaleDate.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1 - months, d));
  return date.toISOString().slice(0, 10);
}
