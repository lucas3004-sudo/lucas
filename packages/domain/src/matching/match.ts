/**
 * Smart Matching : rapprochement d'un bien et d'un profil d'acquéreur (critère F6).
 *
 * - Score de 0 à 100, moyenne pondérée de critères notés de 0 à 1.
 * - Pondérations MODIFIABLES par l'utilisateur (valeurs par défaut ci-dessous).
 * - Explication pour chaque critère : rempli, partiel, non rempli ou inconnu (donnée absente,
 *   critère alors exclu du calcul et signalé « à vérifier »).
 * - LISTE FERMÉE d'équipements : uniquement des caractéristiques du bien, jamais de critère
 *   lié aux personnes (non-discrimination, art. 225-1 du Code pénal ; fiche juridique 1.7).
 */

export const PROPERTY_FEATURES = {
  ascenseur: "Ascenseur",
  balcon_terrasse: "Balcon ou terrasse",
  jardin: "Jardin",
  stationnement: "Parking ou garage",
  cave: "Cave",
  plain_pied: "Plain-pied",
  piscine: "Piscine",
} as const;
export type PropertyFeature = keyof typeof PROPERTY_FEATURES;
export const FEATURE_KEYS = Object.keys(PROPERTY_FEATURES) as PropertyFeature[];

export function isFeature(value: string): value is PropertyFeature {
  return value in PROPERTY_FEATURES;
}

export type MatchType = "Appartement" | "Maison";

export interface MatchProperty {
  type: MatchType;
  price: number | null;
  surface: number | null;
  rooms: number | null;
  inseeCode: string | null;
  features: readonly PropertyFeature[];
}

export interface MatchProfile {
  types: readonly MatchType[];
  budgetMax: number | null;
  surfaceMin: number | null;
  roomsMin: number | null;
  /** Communes acceptées (codes INSEE). Vide = pas de contrainte géographique. */
  inseeCodes: readonly string[];
  /** Équipements souhaités (liste fermée). */
  features: readonly PropertyFeature[];
}

export type CriterionKey = "budget" | "localisation" | "surface" | "pieces" | "equipements";
export type Weights = Record<CriterionKey, number>;

export const DEFAULT_WEIGHTS: Weights = { budget: 35, localisation: 25, surface: 20, pieces: 10, equipements: 10 };

export const CRITERION_LABELS: Record<CriterionKey, string> = {
  budget: "Budget",
  localisation: "Localisation",
  surface: "Surface",
  pieces: "Pièces",
  equipements: "Équipements",
};

export type Satisfaction = "oui" | "partiel" | "non" | "inconnu";

export interface CriterionResult {
  key: CriterionKey;
  satisfaction: Satisfaction;
  /** Note de 0 à 1 (null si inconnu). */
  score: number | null;
  detail: string;
}

export type MatchResult =
  | { compatible: false; reason: string; score: 0; criteria: [] }
  | { compatible: true; score: number; criteria: CriterionResult[]; toVerify: CriterionKey[] };

const BUDGET_TOLERANCE = 0.1; // jusqu'à +10 % au-dessus du budget : note décroissante
const SURFACE_TOLERANCE = 0.15; // jusqu'à −15 % sous la surface minimale : note décroissante

const euros = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} €`;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const satisfaction = (score: number): Satisfaction => (score >= 1 ? "oui" : score > 0 ? "partiel" : "non");

function budget(p: MatchProperty, f: MatchProfile): CriterionResult {
  if (f.budgetMax === null) return { key: "budget", satisfaction: "oui", score: 1, detail: "Pas de budget maximal indiqué." };
  if (p.price === null) return { key: "budget", satisfaction: "inconnu", score: null, detail: "Prix du bien non renseigné." };
  const over = (p.price - f.budgetMax) / f.budgetMax;
  const score = over <= 0 ? 1 : clamp01(1 - over / BUDGET_TOLERANCE);
  const detail = over <= 0
    ? `Prix ${euros(p.price)} dans le budget (${euros(f.budgetMax)}).`
    : `Prix ${euros(p.price)} au-dessus du budget de ${euros(f.budgetMax)} (+${Math.round(over * 100)} %).`;
  return { key: "budget", satisfaction: satisfaction(score), score, detail };
}

function location(p: MatchProperty, f: MatchProfile): CriterionResult {
  if (f.inseeCodes.length === 0) return { key: "localisation", satisfaction: "oui", score: 1, detail: "Pas de secteur imposé." };
  if (!p.inseeCode) return { key: "localisation", satisfaction: "inconnu", score: null, detail: "Commune du bien non renseignée." };
  const ok = f.inseeCodes.includes(p.inseeCode);
  return { key: "localisation", satisfaction: ok ? "oui" : "non", score: ok ? 1 : 0, detail: ok ? "Dans un secteur recherché." : "Hors des secteurs recherchés." };
}

function surface(p: MatchProperty, f: MatchProfile): CriterionResult {
  if (f.surfaceMin === null) return { key: "surface", satisfaction: "oui", score: 1, detail: "Pas de surface minimale indiquée." };
  if (p.surface === null) return { key: "surface", satisfaction: "inconnu", score: null, detail: "Surface du bien non renseignée." };
  const gap = (f.surfaceMin - p.surface) / f.surfaceMin;
  const score = gap <= 0 ? 1 : clamp01(1 - gap / SURFACE_TOLERANCE);
  return {
    key: "surface",
    satisfaction: satisfaction(score),
    score,
    detail: gap <= 0 ? `${p.surface} m² pour ${f.surfaceMin} m² minimum.` : `${p.surface} m², sous le minimum de ${f.surfaceMin} m².`,
  };
}

function rooms(p: MatchProperty, f: MatchProfile): CriterionResult {
  if (f.roomsMin === null) return { key: "pieces", satisfaction: "oui", score: 1, detail: "Pas de nombre de pièces minimal." };
  if (p.rooms === null) return { key: "pieces", satisfaction: "inconnu", score: null, detail: "Nombre de pièces non renseigné." };
  const missing = f.roomsMin - p.rooms;
  const score = missing <= 0 ? 1 : missing === 1 ? 0.5 : 0;
  return { key: "pieces", satisfaction: satisfaction(score), score, detail: `${p.rooms} pièce(s) pour ${f.roomsMin} minimum.` };
}

function features(p: MatchProperty, f: MatchProfile): CriterionResult {
  if (f.features.length === 0) return { key: "equipements", satisfaction: "oui", score: 1, detail: "Aucun équipement exigé." };
  const present = f.features.filter((x) => p.features.includes(x));
  const missing = f.features.filter((x) => !p.features.includes(x));
  const score = present.length / f.features.length;
  const detail = missing.length
    ? `Manque : ${missing.map((m) => PROPERTY_FEATURES[m].toLowerCase()).join(", ")}.`
    : "Tous les équipements souhaités sont présents.";
  return { key: "equipements", satisfaction: satisfaction(score), score, detail };
}

export function matchProperty(property: MatchProperty, profile: MatchProfile, weights: Weights = DEFAULT_WEIGHTS): MatchResult {
  if (profile.types.length > 0 && !profile.types.includes(property.type)) {
    return { compatible: false, reason: `Recherche : ${profile.types.join(" ou ").toLowerCase()} ; bien : ${property.type.toLowerCase()}.`, score: 0, criteria: [] };
  }
  const criteria = [budget(property, profile), location(property, profile), surface(property, profile), rooms(property, profile), features(property, profile)];
  let total = 0;
  let weightSum = 0;
  for (const c of criteria) {
    const w = Math.max(0, weights[c.key] ?? 0);
    if (c.score === null || w === 0) continue;
    total += c.score * w;
    weightSum += w;
  }
  return {
    compatible: true,
    score: weightSum === 0 ? 0 : Math.round((total / weightSum) * 100),
    criteria,
    toVerify: criteria.filter((c) => c.satisfaction === "inconnu").map((c) => c.key),
  };
}
