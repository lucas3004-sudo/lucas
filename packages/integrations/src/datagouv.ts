/**
 * Catalogue data.gouv.fr : les URL des fichiers changent à chaque millésime ; on les lit
 * toujours dans l'API plutôt que de les coder en dur (docs/phase-2/ingestion.md, section 1).
 */
import { requestJson, type Fetcher } from "./http";

export interface DataGouvResource {
  title: string;
  url: string;
  format: string | null;
  filesize: number | null;
  last_modified: string;
}

export interface DataGouvDataset {
  title: string;
  slug: string;
  license: string | null;
  last_update: string;
  resources: DataGouvResource[];
}

const API = "https://www.data.gouv.fr/api/1/datasets";

export function getDataset(slug: string, fetcher?: Fetcher): Promise<DataGouvDataset> {
  return requestJson<DataGouvDataset>(`${API}/${slug}/`, { source: "data.gouv.fr", fetcher });
}

export async function searchDatasets(query: string, fetcher?: Fetcher): Promise<DataGouvDataset[]> {
  const page = await requestJson<{ data: DataGouvDataset[] }>(
    `${API}/?q=${encodeURIComponent(query)}&page_size=20`,
    { source: "data.gouv.fr", fetcher },
  );
  return page.data;
}
