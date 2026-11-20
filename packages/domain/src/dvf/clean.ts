/**
 * Nettoyage des « Demandes de valeurs foncières » (DVF géolocalisées, Etalab).
 * Règles R1 à R5 de docs/phase-2/ingestion.md (décision D-017), portées à l'identique
 * du prototype prototypes/dvf/clean_dvf.py et vérifiées par un test de référence.
 *
 * Une ligne DVF = un local × une parcelle × une nature de culture. Une vente (mutation)
 * occupe donc souvent plusieurs lignes : elles sont regroupées par id_mutation.
 */
import { quantileInclusive } from "../stats";

/** Colonnes utilisées du fichier DVF géolocalisées (valeurs brutes, en texte). */
export interface DvfLine {
  id_mutation: string;
  date_mutation: string;
  nature_mutation: string;
  valeur_fonciere: string;
  code_commune: string;
  id_parcelle: string;
  lot1_numero: string;
  type_local: string;
  surface_reelle_bati: string;
  nombre_pieces_principales: string;
  nature_culture: string;
  surface_terrain: string;
  longitude: string;
  latitude: string;
}

export type SaleNature = "ancien" | "neuf";
export type DwellingType = "Appartement" | "Maison";

export interface CleanSale {
  mutationId: string;
  date: string;
  nature: SaleNature;
  type: DwellingType;
  inseeCode: string;
  price: number;
  surface: number;
  rooms: number | null;
  landSurface: number;
  pricePerSqm: number;
  longitude: number | null;
  latitude: number | null;
}

export type RuleId = "R1" | "R3" | "R4" | "R5";

export const RULE_LABELS: Record<RuleId, string> = {
  R1: "Nature de mutation exclue (adjudication, échange, terrain à bâtir…)",
  R3: "Composition : zéro ou plusieurs logements, ou local commercial",
  R4: "Surface inférieure à 9 m² ou valeur absente",
  R5: "Prix au m² extrême",
};

const NATURES: Record<string, SaleNature> = {
  Vente: "ancien",
  "Vente en l'état futur d'achèvement": "neuf",
};
const DWELLINGS = new Set(["Appartement", "Maison"]);
export const ABSOLUTE_BOUNDS = { min: 200, max: 25_000 } as const;
const MIN_SURFACE = 9;
const MIN_GROUP_FOR_IQR = 8;

function num(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function groupByMutation(lines: Iterable<DvfLine>): Map<string, DvfLine[]> {
  const groups = new Map<string, DvfLine[]>();
  for (const line of lines) {
    const group = groups.get(line.id_mutation);
    if (group) group.push(line);
    else groups.set(line.id_mutation, [line]);
  }
  return groups;
}

/** Applique R1 à R4 à une vente (toutes ses lignes). */
export function cleanMutation(lines: readonly DvfLine[]): { sale: CleanSale } | { excluded: Exclude<RuleId, "R5"> } {
  const first = lines[0];
  if (!first) throw new Error("Mutation sans ligne.");
  const nature = NATURES[first.nature_mutation];
  if (!nature) return { excluded: "R1" };

  // R2 : un local répété sur plusieurs lignes n'est compté qu'une fois.
  const locals = new Map<string, DvfLine>();
  for (const line of lines) {
    if (!line.type_local) continue;
    const key = [line.type_local, line.surface_reelle_bati, line.nombre_pieces_principales, line.id_parcelle, line.lot1_numero].join("|");
    if (!locals.has(key)) locals.set(key, line);
  }
  let dwellings = 0;
  let others = 0;
  let dwelling: DvfLine | undefined;
  for (const local of locals.values()) {
    if (DWELLINGS.has(local.type_local)) {
      dwellings++;
      dwelling = local;
    } else if (local.type_local !== "Dépendance") {
      others++;
    }
  }
  if (dwellings !== 1 || others > 0 || !dwelling) return { excluded: "R3" };

  const surface = num(dwelling.surface_reelle_bati);
  const price = num(first.valeur_fonciere);
  if (surface === null || surface < MIN_SURFACE || price === null || price <= 0) return { excluded: "R4" };

  // Terrain : une surface par couple (parcelle, nature de culture), sans double compte.
  const parcels = new Map<string, number>();
  for (const line of lines) parcels.set(`${line.id_parcelle}|${line.nature_culture}`, num(line.surface_terrain) ?? 0);
  const landSurface = [...parcels.values()].reduce((a, b) => a + b, 0);

  return {
    sale: {
      mutationId: first.id_mutation,
      date: first.date_mutation,
      nature,
      type: dwelling.type_local as DwellingType,
      inseeCode: first.code_commune,
      price,
      surface,
      rooms: num(dwelling.nombre_pieces_principales),
      landSurface,
      pricePerSqm: price / surface,
      longitude: num(dwelling.longitude) ?? num(first.longitude),
      latitude: num(dwelling.latitude) ?? num(first.latitude),
    },
  };
}

/** R5 : écarte les prix au m² extrêmes, par groupe (type × nature). */
export function removeOutliers(sales: readonly CleanSale[]): { kept: CleanSale[]; excluded: number } {
  const groups = new Map<string, CleanSale[]>();
  for (const sale of sales) {
    const key = `${sale.type}|${sale.nature}`;
    const group = groups.get(key);
    if (group) group.push(sale);
    else groups.set(key, [sale]);
  }
  const kept: CleanSale[] = [];
  let excluded = 0;
  for (const group of groups.values()) {
    let low: number = ABSOLUTE_BOUNDS.min;
    let high: number = ABSOLUTE_BOUNDS.max;
    if (group.length >= MIN_GROUP_FOR_IQR) {
      const sorted = group.map((s) => s.pricePerSqm).sort((a, b) => a - b);
      const q1 = quantileInclusive(sorted, 0.25);
      const q3 = quantileInclusive(sorted, 0.75);
      low = Math.max(ABSOLUTE_BOUNDS.min, q1 - 3 * (q3 - q1));
      high = Math.min(ABSOLUTE_BOUNDS.max, q3 + 3 * (q3 - q1));
    }
    for (const sale of group) {
      if (sale.pricePerSqm >= low && sale.pricePerSqm <= high) kept.push(sale);
      else excluded++;
    }
  }
  return { kept, excluded };
}

export interface CleanReport {
  lines: number;
  mutations: number;
  sales: CleanSale[];
  exclusions: Record<RuleId, number>;
}

export function cleanDvf(lines: readonly DvfLine[]): CleanReport {
  const groups = groupByMutation(lines);
  const exclusions: Record<RuleId, number> = { R1: 0, R3: 0, R4: 0, R5: 0 };
  const candidates: CleanSale[] = [];
  for (const group of groups.values()) {
    const result = cleanMutation(group);
    if ("sale" in result) candidates.push(result.sale);
    else exclusions[result.excluded]++;
  }
  const { kept, excluded } = removeOutliers(candidates);
  exclusions.R5 = excluded;
  return { lines: lines.length, mutations: groups.size, sales: kept, exclusions };
}
