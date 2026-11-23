/**
 * Verdict d'une annonce (« ça vaut le coup ? »), calculé avec les chiffres réels, sans IA :
 * - fourchette estimée à partir des ventes comparables (DVF autour du bien) ;
 * - position du prix au m² par rapport à la médiane de la commune ;
 * - rendement locatif brut estimé (loyers d'annonce ANIL).
 * Chaque raison cite ses chiffres. Ce n'est pas un avis de valeur engageant.
 */
import { MARKET_GAP, type MarketPosition } from "./position";

export type ListingVerdict = "bonne_affaire" | "prix_coherent" | "prix_eleve" | "incomplet";

export interface VerdictInput {
  price: number | null;
  surface: number | null;
  /** Fourchette estimée (null : pas assez de ventes comparables). */
  estimate: { low: number; mid: number; high: number; comparables: number } | null;
  position: MarketPosition;
  /** Loyer mensuel estimé, charges comprises (null : pas d'indicateur). */
  rent: { monthlyLow: number; monthlyHigh: number; millesime: number } | null;
  city: string | null;
}

export interface VerdictResult {
  verdict: ListingVerdict;
  reasons: string[];
  /** Écart du prix au milieu de la fourchette (−0,12 = 12 % sous l'estimation). */
  gapToEstimate: number | null;
  grossYield: { low: number; high: number } | null;
}

const eur = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} €`;
const pct = (v: number, signed = true) => `${signed && v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v * 100))} %`;
const pct1 = (v: number) => `${(v * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

export const VERDICT_LABELS: Record<ListingVerdict, string> = {
  bonne_affaire: "Bonne affaire",
  prix_coherent: "Prix cohérent avec le marché",
  prix_eleve: "Prix élevé pour le marché",
  incomplet: "Analyse incomplète",
};

export function listingVerdict(input: VerdictInput): VerdictResult {
  const { price, surface, estimate, position, rent } = input;
  if (!price || !surface) {
    return { verdict: "incomplet", reasons: ["Renseignez le prix et la surface pour comparer le bien au marché."], gapToEstimate: null, grossYield: null };
  }
  const reasons: string[] = [];
  let verdict: ListingVerdict = "prix_coherent";
  let gapToEstimate: number | null = null;

  if (estimate) {
    // Le verdict suit l'écart au MILIEU de la fourchette (même seuil de ±10 % que la carte) :
    // une fourchette large ne doit pas masquer un prix nettement sous ou au-dessus du marché.
    gapToEstimate = Math.round((price / estimate.mid - 1) * 1000) / 1000;
    const range = `${eur(estimate.low)} – ${eur(estimate.high)}`;
    const basis = `établie sur ${estimate.comparables} ventes comparables autour du bien`;
    if (gapToEstimate <= -MARKET_GAP) {
      verdict = "bonne_affaire";
      reasons.push(price < estimate.low
        ? `Prix sous la fourchette estimée (${range}), ${basis} (${pct(gapToEstimate)} par rapport au milieu).`
        : `Prix dans le bas de la fourchette estimée (${range}), ${pct(gapToEstimate)} par rapport à son milieu, ${basis}.`);
    } else if (gapToEstimate >= MARKET_GAP) {
      verdict = "prix_eleve";
      reasons.push(price > estimate.high
        ? `Prix au-dessus de la fourchette estimée (${range}), ${basis} (${pct(gapToEstimate)} par rapport au milieu).`
        : `Prix dans le haut de la fourchette estimée (${range}), ${pct(gapToEstimate)} par rapport à son milieu, ${basis}.`);
    } else {
      reasons.push(`Prix proche du milieu de la fourchette estimée (${range}), ${basis}.`);
    }
  }

  if (position.kind !== "inconnu") {
    const where = input.city ? ` à ${input.city}` : " dans la commune";
    reasons.push(`Prix au m² : ${eur(price / surface)} contre ${eur(position.median)} de médiane${where} (${pct(position.gap)}, ${position.sales.toLocaleString("fr-FR")} ventes sur 24 mois).`);
    // Sans fourchette, la médiane communale décide seule.
    if (!estimate) verdict = position.kind === "sous_marche" ? "bonne_affaire" : position.kind === "au_dessus" ? "prix_eleve" : "prix_coherent";
  } else if (!estimate) {
    verdict = "incomplet";
    reasons.push("Pas assez de ventes réelles autour du bien pour le comparer au marché.");
  }

  let grossYield: VerdictResult["grossYield"] = null;
  if (rent) {
    grossYield = { low: (rent.monthlyLow * 12) / price, high: (rent.monthlyHigh * 12) / price };
    reasons.push(`Rendement locatif brut estimé : ${pct1(grossYield.low)} à ${pct1(grossYield.high)} (loyer de ${eur(rent.monthlyLow)} à ${eur(rent.monthlyHigh)} par mois, indicateurs ANIL ${rent.millesime}).`);
  }
  return { verdict, reasons, gapToEstimate, grossYield };
}
