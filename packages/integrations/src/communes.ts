/**
 * Communes par code postal (API Géo, geo.api.gouv.fr). Un code postal peut couvrir plusieurs
 * communes, et une commune plusieurs codes postaux.
 */
import { requestJson, type Fetcher } from "./http";

export interface Commune {
  inseeCode: string;
  name: string;
  postcodes: string[];
}

export async function communesByPostcode(postcode: string, fetcher?: Fetcher): Promise<Commune[]> {
  if (!/^\d{5}$/.test(postcode)) return [];
  const data = await requestJson<Array<{ code: string; nom: string; codesPostaux?: string[] }>>(
    `https://geo.api.gouv.fr/communes?codePostal=${postcode}&fields=nom,code,codesPostaux`,
    { source: "API Géo", timeoutMs: 8_000, retries: 2, fetcher },
  );
  return data.map((c) => ({ inseeCode: c.code, name: c.nom, postcodes: c.codesPostaux ?? [] }));
}
