/**
 * Position d'un prix affiché par rapport au marché local (repère « bonne affaire » de la carte).
 * Référence : prix au m² MÉDIAN des ventes réelles (DVF) de la même commune et du même type de
 * bien, sur les 24 derniers mois. C'est un REPÈRE, pas une estimation : un bien neuf, rénové ou
 * avec vue se vend légitimement plus cher que la médiane.
 */

/** Écart à partir duquel le prix est signalé comme sous ou au-dessus du marché. */
export const MARKET_GAP = 0.1;
/** Nombre minimal de ventes pour qu'une médiane soit utilisable. */
export const MIN_MARKET_SALES = 10;

export type MarketPosition =
  | { kind: "sous_marche" | "dans_marche" | "au_dessus"; gap: number; median: number; sales: number }
  | { kind: "inconnu"; reason: "prix_ou_surface" | "pas_assez_de_ventes" };

export function marketPosition(
  property: { price: number | null; surface: number | null },
  market: { median: number; sales: number } | null,
): MarketPosition {
  if (!property.price || !property.surface) return { kind: "inconnu", reason: "prix_ou_surface" };
  if (!market || market.sales < MIN_MARKET_SALES || market.median <= 0) return { kind: "inconnu", reason: "pas_assez_de_ventes" };
  // Arrondi au dix-millième : évite qu’un écart de −10 % exact soit lu −9,9999… %.
  const gap = Math.round((property.price / property.surface / market.median - 1) * 10_000) / 10_000;
  const kind = gap <= -MARKET_GAP ? "sous_marche" : gap >= MARKET_GAP ? "au_dessus" : "dans_marche";
  return { kind, gap, median: market.median, sales: market.sales };
}

export function marketPositionLabel(p: MarketPosition): string {
  if (p.kind === "inconnu") return p.reason === "prix_ou_surface" ? "Prix ou surface manquant" : "Pas assez de ventes pour comparer";
  const pct = `${p.gap > 0 ? "+" : "−"}${Math.round(Math.abs(p.gap) * 100)} %`;
  if (p.kind === "sous_marche") return `Sous le marché (${pct})`;
  if (p.kind === "au_dessus") return `Au-dessus du marché (${pct})`;
  return `Dans le marché (${pct})`;
}
