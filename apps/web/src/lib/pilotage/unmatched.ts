/**
 * Biens sans acquéreur correspondant (critère F13) : pour chaque bien proposé, meilleur score
 * parmi les profils de recherche actifs de l'agence (pondérations par défaut).
 */
import { matchProperty, type MatchProfile, type MatchProperty } from "@immopilot/domain";

/** En dessous de ce score, aucun acquéreur de l'agence ne correspond vraiment. */
export const MATCH_THRESHOLD = 50;

export interface CoverageRow<P> {
  property: P;
  /** Meilleur score obtenu ; null si aucun profil n'est compatible (type de bien différent ou aucun profil). */
  bestScore: number | null;
}

export function propertiesWithoutBuyer<P>(
  properties: readonly P[],
  profiles: readonly MatchProfile[],
  toMatch: (p: P) => MatchProperty,
  threshold = MATCH_THRESHOLD,
): CoverageRow<P>[] {
  return properties
    .map((property) => {
      const m = toMatch(property);
      let best: number | null = null;
      for (const profile of profiles) {
        const r = matchProperty(m, profile);
        if (r.compatible && (best === null || r.score > best)) best = r.score;
      }
      return { property, bestScore: best };
    })
    .filter((row) => row.bestScore === null || row.bestScore < threshold);
}
