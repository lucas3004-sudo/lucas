/**
 * DVF géolocalisées : fichiers nationaux (un par année ou semestre) sur static.data.gouv.fr.
 * Lecture EN FLUX (décompression et filtrage par département à la volée) : on ne stocke
 * jamais le fichier national (≈ 110 Mo compressés par an).
 */
import { parseCsv, type DvfLine } from "@immopilot/domain";
import { getDataset, type DataGouvResource } from "./datagouv";
import { request, type Fetcher } from "./http";

export const DVF_DATASET = "demandes-de-valeurs-foncieres-geolocalisees";
export const DVF_CITATION = "Demandes de valeurs foncières géolocalisées (DGFiP, Etalab), Licence Ouverte";

/** Départements sans DVF (régime du Livre foncier) et Mayotte. */
export const DVF_UNCOVERED_DEPARTMENTS = new Set(["57", "67", "68", "976"]);

export type DvfRecord = DvfLine & { code_departement: string };

/** Fichiers par période, du plus ancien au plus récent (exclut le fichier unique et l'archive). */
export async function listDvfFiles(fetcher?: Fetcher): Promise<DataGouvResource[]> {
  const dataset = await getDataset(DVF_DATASET, fetcher);
  return dataset.resources
    .filter((r) => r.url.endsWith(".csv.gz") && /^DVF \d{4}/.test(r.title))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Lit un fichier national en flux et renvoie seulement les lignes des départements demandés. */
export async function* streamDvf(url: string, departments: ReadonlySet<string>, fetcher?: Fetcher): AsyncGenerator<DvfRecord> {
  const response = await request(url, { source: "DVF", timeoutMs: 600_000, fetcher });
  if (!response.body) throw new Error("DVF : réponse sans contenu.");
  const text = response.body.pipeThrough(new DecompressionStream("gzip")).pipeThrough(new TextDecoderStream());
  let header: string[] | null = null;
  let departmentIndex = -1;
  let rest = "";
  for await (const chunk of text) {
    rest += chunk;
    const lines = rest.split("\n");
    rest = lines.pop() ?? "";
    for (const line of lines) {
      const record = parseLine(line);
      if (record) yield record;
    }
  }
  const last = parseLine(rest);
  if (last) yield last;

  function parseLine(line: string): DvfRecord | null {
    if (!line.trim()) return null;
    const cells = parseCsv(line)[0];
    if (!cells) return null;
    if (!header) {
      header = cells;
      departmentIndex = header.indexOf("code_departement");
      if (departmentIndex < 0) throw new Error("DVF : colonne code_departement absente (format modifié ?).");
      return null;
    }
    if (!departments.has(cells[departmentIndex] ?? "")) return null;
    return Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""])) as unknown as DvfRecord;
  }
}
