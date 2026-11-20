/**
 * DPE des logements existants (ADEME, jeu dpe03existant), rapprochés par identifiant BAN
 * (décision D-019 : 5 rapprochements sur 5 vérifiés à Amiens).
 */
import { requestJson, type Fetcher } from "./http";

export const DPE_CITATION = "Diagnostics de performance énergétique (ADEME), Licence Ouverte 2.0";
const URL = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines";

const FIELDS = [
  "numero_dpe", "date_etablissement_dpe", "date_fin_validite_dpe", "numero_dpe_remplace", "etiquette_dpe",
  "etiquette_ges", "conso_5_usages_par_m2_ep", "emission_ges_5_usages_par_m2", "cout_total_5_usages",
  "surface_habitable_logement", "type_batiment", "type_energie_principale_chauffage", "identifiant_ban", "adresse_ban",
] as const;

export interface DpeRecord {
  numero: string;
  date: string;
  validUntil: string | null;
  energyClass: string;
  climateClass: string;
  energyPerSqm: number | null;
  ghgPerSqm: number | null;
  annualCost: number | null;
  surface: number | null;
  buildingType: string | null;
  heatingEnergy: string | null;
  address: string;
  /** DPE antérieur au 1er janvier 2026 avec chauffage électrique : classe susceptible d'avoir changé. */
  electricityCoefficientChange: boolean;
  expired: boolean;
}

type Raw = Partial<Record<(typeof FIELDS)[number], string | number | null>>;

export function toDpeRecord(raw: Raw, today = new Date().toISOString().slice(0, 10)): DpeRecord {
  const date = String(raw.date_etablissement_dpe ?? "");
  const validUntil = raw.date_fin_validite_dpe ? String(raw.date_fin_validite_dpe) : null;
  const heating = raw.type_energie_principale_chauffage ? String(raw.type_energie_principale_chauffage) : null;
  const n = (v: unknown) => (typeof v === "number" ? v : v ? Number(v) : null);
  return {
    numero: String(raw.numero_dpe ?? ""),
    date,
    validUntil,
    energyClass: String(raw.etiquette_dpe ?? ""),
    climateClass: String(raw.etiquette_ges ?? ""),
    energyPerSqm: n(raw.conso_5_usages_par_m2_ep),
    ghgPerSqm: n(raw.emission_ges_5_usages_par_m2),
    annualCost: n(raw.cout_total_5_usages),
    surface: n(raw.surface_habitable_logement),
    buildingType: raw.type_batiment ? String(raw.type_batiment) : null,
    heatingEnergy: heating,
    address: String(raw.adresse_ban ?? ""),
    electricityCoefficientChange: date < "2026-01-01" && /lectricit/i.test(heating ?? ""),
    expired: validUntil !== null && validUntil < today,
  };
}

/** DPE trouvés à une adresse BAN, du plus récent au plus ancien, sans les DPE remplacés. */
export async function dpeByBanId(banId: string, fetcher?: Fetcher): Promise<DpeRecord[]> {
  const params = new URLSearchParams({
    qs: `identifiant_ban:"${banId.replace(/"/g, "")}"`,
    size: "50",
    select: FIELDS.join(","),
    sort: "-date_etablissement_dpe",
  });
  const data = await requestJson<{ results: Raw[] }>(`${URL}?${params}`, { source: "ADEME (DPE)", timeoutMs: 15_000, fetcher });
  const replaced = new Set(data.results.map((r) => String(r.numero_dpe_remplace ?? "")).filter(Boolean));
  return data.results.filter((r) => !replaced.has(String(r.numero_dpe ?? ""))).map((r) => toDpeRecord(r));
}
