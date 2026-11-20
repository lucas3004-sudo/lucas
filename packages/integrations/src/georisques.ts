/**
 * Géorisques (BRGM / Ministère) : rapport de risques à une adresse (coordonnées).
 * Pour chaque risque, deux statuts : celui de la COMMUNE et celui de l'ADRESSE. Les deux
 * sont affichés : un risque peut exister dans la commune sans concerner l'adresse.
 */
import { requestJson, type Fetcher } from "./http";

export const GEORISQUES_CITATION = "Géorisques (BRGM, ministère de la Transition écologique)";
const URL = "https://georisques.gouv.fr/api/v1/resultats_rapport_risque";

const LABELS: Record<string, string> = {
  inondation: "Inondation", remonteeNappe: "Remontée de nappe", risqueCotier: "Risques côtiers", seisme: "Séisme",
  mouvementTerrain: "Mouvement de terrain", reculTraitCote: "Recul du trait de côte",
  retraitGonflementArgile: "Retrait-gonflement des argiles", avalanche: "Avalanche", feuForet: "Feu de forêt",
  eruptionVolcanique: "Éruption volcanique", cyclone: "Cyclone", radon: "Radon",
  icpe: "Installations industrielles (ICPE)", nucleaire: "Nucléaire",
  canalisationsMatieresDangereuses: "Canalisations de matières dangereuses", pollutionSols: "Pollution des sols",
  ruptureBarrage: "Rupture de barrage", risqueMinier: "Risque minier",
};

interface RawRisk { present?: boolean; libelleStatutCommune?: string | null; libelleStatutAdresse?: string | null }
export interface RawReport {
  url?: string;
  risquesNaturels?: Record<string, RawRisk>;
  risquesTechnologiques?: Record<string, RawRisk>;
}

export interface Risk {
  key: string;
  label: string;
  kind: "naturel" | "technologique";
  commune: string | null;
  address: string | null;
}

export interface RiskReport {
  officialReportUrl: string | null;
  risks: Risk[];
}

/** Ne garde que les risques présents dans la commune (les autres sont « non concernés »). */
export function toRiskReport(raw: RawReport): RiskReport {
  const risks: Risk[] = [];
  for (const [kind, group] of [["naturel", raw.risquesNaturels], ["technologique", raw.risquesTechnologiques]] as const) {
    for (const [key, risk] of Object.entries(group ?? {})) {
      if (!risk?.present) continue;
      risks.push({ key, label: LABELS[key] ?? key, kind, commune: risk.libelleStatutCommune ?? null, address: risk.libelleStatutAdresse ?? null });
    }
  }
  return { officialReportUrl: raw.url ?? null, risks };
}

export async function fetchRiskReport(longitude: number, latitude: number, fetcher?: Fetcher): Promise<RawReport> {
  return requestJson<RawReport>(`${URL}?latlon=${longitude},${latitude}`, { source: "Géorisques", timeoutMs: 15_000, retries: 3, fetcher });
}
