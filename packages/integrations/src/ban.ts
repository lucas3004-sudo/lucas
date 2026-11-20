/**
 * Base Adresse Nationale, via le service de géocodage de la Géoplateforme (IGN).
 * L'ancienne API (api-adresse.data.gouv.fr) est en cours de retrait : on ne l'utilise pas.
 */
import { requestJson, type Fetcher } from "./http";

export const BAN_CITATION = "Base Adresse Nationale (IGN, Géoplateforme)";
const URL = "https://data.geopf.fr/geocodage/search";

export interface Address {
  label: string;
  banId: string;
  inseeCode: string;
  postcode: string;
  city: string;
  department: string;
  longitude: number;
  latitude: number;
  score: number;
  type: string;
}

interface BanFeature {
  geometry: { coordinates: [number, number] };
  properties: { label: string; id: string; citycode: string; postcode: string; city: string; score: number; type: string; context?: string };
}

export async function geocode(query: string, options: { limit?: number; fetcher?: Fetcher } = {}): Promise<Address[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({ q, limit: String(options.limit ?? 5), index: "address" });
  const data = await requestJson<{ features: BanFeature[] }>(`${URL}?${params}`, {
    source: "BAN",
    timeoutMs: 8_000,
    retries: 2,
    fetcher: options.fetcher,
  });
  return data.features.map((f) => ({
    label: f.properties.label,
    banId: f.properties.id,
    inseeCode: f.properties.citycode,
    postcode: f.properties.postcode,
    city: f.properties.city,
    department: departmentOf(f.properties.citycode),
    longitude: f.geometry.coordinates[0],
    latitude: f.geometry.coordinates[1],
    score: f.properties.score,
    type: f.properties.type,
  }));
}

/** Code département à partir du code INSEE (Corse 2A/2B, outre-mer sur 3 chiffres). */
export function departmentOf(inseeCode: string): string {
  if (inseeCode.startsWith("97")) return inseeCode.slice(0, 3);
  return inseeCode.slice(0, 2);
}
