/**
 * Zonage ABC (Ministère) : zone de tension du marché par commune. CSV UTF-8, séparateur « ; ».
 * L'en-tête de la 4e colonne porte la date d'entrée en vigueur (« … en vigueur depuis le 26 juin 2026 »).
 */
import { parseCsv } from "@immopilot/domain";
import { getDataset } from "./datagouv";
import { request, type Fetcher } from "./http";

export const ZONAGE_DATASET = "liste-des-communes-selon-le-zonage-abc";

export interface ZonageRow {
  inseeCode: string;
  commune: string;
  zone: string;
}

const MONTHS: Record<string, string> = {
  janvier: "01", fevrier: "02", février: "02", mars: "03", avril: "04", mai: "05", juin: "06",
  juillet: "07", aout: "08", août: "08", septembre: "09", octobre: "10", novembre: "11", decembre: "12", décembre: "12",
};

export function parseInForceDate(header: string): string | null {
  const m = header.match(/(\d{1,2})\s+([a-zéû]+)\s+(\d{4})/i);
  const month = m ? MONTHS[m[2]!.toLowerCase()] : undefined;
  return m && month ? `${m[3]}-${month}-${m[1]!.padStart(2, "0")}` : null;
}

export function parseZonageCsv(text: string): { rows: ZonageRow[]; inForceFrom: string | null } {
  const [header, ...lines] = parseCsv(text.replace(/^﻿/, ""), ";");
  if (!header || header[0] !== "CODGEO") throw new Error("Zonage ABC : format inattendu.");
  return {
    inForceFrom: parseInForceDate(header[3] ?? ""),
    rows: lines.filter((l) => l[0] && l[3]).map((l) => ({ inseeCode: l[0]!, commune: l[2] ?? "", zone: l[3]! })),
  };
}

export async function downloadZonage(fetcher?: Fetcher) {
  const dataset = await getDataset(ZONAGE_DATASET, fetcher);
  const resource = dataset.resources
    .filter((r) => r.url.endsWith(".csv") && /ensemble des communes/i.test(r.title))
    .sort((a, b) => b.last_modified.localeCompare(a.last_modified))[0];
  if (!resource) throw new Error("Zonage ABC : fichier introuvable.");
  const text = await (await request(resource.url, { source: "Zonage ABC", fetcher })).text();
  return { ...parseZonageCsv(text), url: resource.url };
}
