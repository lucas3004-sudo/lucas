/**
 * Carte des loyers (Ministère / ANIL) : loyers d'annonce par commune, charges comprises,
 * logement non meublé (décision D-012). Fichiers CSV en Latin-1, séparateur « ; »,
 * décimales à virgule. Citation imposée : RENTS_CITATION.
 */
import { csvRecords } from "@immopilot/domain";
import { searchDatasets, type DataGouvDataset } from "./datagouv";
import { request, type Fetcher } from "./http";

export const RENTS_CITATION = "Estimations ANIL, à partir des données du Groupe SeLoger et de leboncoin";

export type RentSegment = "appartement" | "appartement_t1_t2" | "appartement_t3_plus" | "maison";

const SEGMENT_FILES: Record<RentSegment, RegExp> = {
  appartement: /pred-app-/,
  appartement_t1_t2: /pred-app12-/,
  appartement_t3_plus: /pred-app3-/,
  maison: /pred-mai-/,
};

export interface RentRow {
  inseeCode: string;
  segment: RentSegment;
  rentPerSqm: number;
  low: number;
  high: number;
  prediction: string;
  obsCommune: number | null;
  obsMaille: number | null;
  r2Adj: number | null;
}

const frNumber = (value: string | undefined): number | null => {
  if (!value) return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Jeu de données le plus récent de la Carte des loyers, avec son millésime. */
export async function latestRentsDataset(fetcher?: Fetcher): Promise<{ dataset: DataGouvDataset; millesime: number }> {
  const found = await searchDatasets("carte des loyers indicateurs de loyers d'annonce par commune", fetcher);
  const candidates = found
    .map((dataset) => ({ dataset, millesime: Number(dataset.title.match(/en (\d{4})/)?.[1]) }))
    .filter((c) => Number.isFinite(c.millesime) && /carte des loyers/i.test(c.dataset.title))
    .sort((a, b) => b.millesime - a.millesime);
  const latest = candidates[0];
  if (!latest) throw new Error("Carte des loyers introuvable sur data.gouv.fr.");
  return latest;
}

export function parseRentsCsv(text: string, segment: RentSegment): RentRow[] {
  return csvRecords(text, ";").flatMap((r) => {
    const rent = frNumber(r.loypredm2);
    const low = frNumber(r["lwr.IPm2"]);
    const high = frNumber(r["upr.IPm2"]);
    if (!r.INSEE_C || rent === null || low === null || high === null) return [];
    return [{
      inseeCode: r.INSEE_C,
      segment,
      rentPerSqm: rent,
      low,
      high,
      prediction: r.TYPPRED ?? "",
      obsCommune: frNumber(r.nbobs_com),
      obsMaille: frNumber(r.nbobs_mail),
      r2Adj: frNumber(r.R2_adj),
    }];
  });
}

export async function downloadRents(dataset: DataGouvDataset, fetcher?: Fetcher): Promise<{ rows: RentRow[]; urls: string[] }> {
  const rows: RentRow[] = [];
  const urls: string[] = [];
  for (const [segment, pattern] of Object.entries(SEGMENT_FILES) as [RentSegment, RegExp][]) {
    const resource = dataset.resources.find((r) => pattern.test(r.url) && r.url.endsWith(".csv"));
    if (!resource) throw new Error(`Carte des loyers : fichier « ${segment} » introuvable.`);
    const buffer = await (await request(resource.url, { source: "Carte des loyers", timeoutMs: 120_000, fetcher })).arrayBuffer();
    rows.push(...parseRentsCsv(new TextDecoder("latin1").decode(buffer), segment));
    urls.push(resource.url);
  }
  return { rows, urls };
}
