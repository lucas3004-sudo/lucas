/**
 * Crédits IA à l'usage (D-065, décision du fondateur du 23/11/2026) : au-delà des échanges inclus
 * dans la formule, l'agence paie ce qu'elle consomme, sur sa facture suivante. Le gérant fixe un
 * plafond mensuel (30 € par défaut, 0 = désactivé) pour éviter toute mauvaise surprise.
 * Réservé aux agences abonnées (il faut un moyen de paiement pour facturer).
 */

export type OverageMetric = "copilot" | "annonces_ia";

/** Prix unitaires HT, en centimes : 2 € les 100 échanges, 0,20 € l'annonce rédigée par IA. */
export const OVERAGE_UNIT_CENTS: Record<OverageMetric, number> = { copilot: 2, annonces_ia: 20 };
export const DEFAULT_OVERAGE_CAP_CENTS = 3000;
/** Plafond maximal qu'un gérant peut choisir (500 €), par prudence. */
export const MAX_OVERAGE_CAP_CENTS = 50_000;

export interface OverageUsage {
  copilot: number;
  annonces: number;
  cents: number;
}

/** Montant en euros lisible (« 2,40 € »). */
export function centsLabel(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** Plafond saisi en euros par le gérant → centimes, ou null si la valeur est invalide. */
export function parseOverageCap(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return cents <= MAX_OVERAGE_CAP_CENTS ? cents : null;
}

/** Ligne de facture des crédits consommés sur une période, ou null s'il n'y a rien à facturer. */
export function overageInvoiceLine(usage: OverageUsage): { cents: number; description: string } | null {
  if (usage.cents <= 0) return null;
  const parts = [
    usage.copilot ? `${usage.copilot} échange(s) avec l'assistant` : null,
    usage.annonces ? `${usage.annonces} annonce(s) rédigée(s) par IA` : null,
  ].filter(Boolean);
  return { cents: usage.cents, description: `Crédits IA au-delà du forfait : ${parts.join(", ") || "consommation IA"}` };
}
