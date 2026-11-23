/**
 * Critères de recherche de la carte (fonctions pures, testées) : lieu et rayon, prix, surface,
 * pièces, prix au m², DPE, équipements, statut, bonnes affaires, tri.
 */
import type { MapProperty } from "./data";

export const DPE_ORDER = ["A", "B", "C", "D", "E", "F", "G"] as const;
export type SortKey = "affaires" | "prix_asc" | "prix_desc" | "prix_m2" | "surface";

export interface MapFilters {
  type: "tous" | "Appartement" | "Maison";
  statuses: ReadonlySet<MapProperty["status"]>;
  minPrice: number | null;
  maxPrice: number | null;
  minSurface: number | null;
  maxSurface: number | null;
  minRooms: number | null;
  maxPricePerSqm: number | null;
  /** Classe DPE la moins bonne acceptée (ex. « D » : A à D). */
  worstDpe: (typeof DPE_ORDER)[number] | null;
  features: ReadonlySet<string>;
  dealsOnly: boolean;
  mineOnly: boolean;
  withPhotos: boolean;
  /** Lieu choisi et rayon en km (null : pas de limite). */
  place: { lon: number; lat: number } | null;
  radiusKm: number | null;
  sort: SortKey;
}

/** Distance à vol d'oiseau en km (formule de haversine). */
export function distanceKm(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const perSqm = (p: MapProperty) => (p.price && p.surface ? p.price / p.surface : null);

export function applyFilters(properties: readonly MapProperty[], f: MapFilters): MapProperty[] {
  const worst = f.worstDpe ? DPE_ORDER.indexOf(f.worstDpe) : null;
  const kept = properties.filter((p) => {
    if (f.type !== "tous" && p.type !== f.type) return false;
    if (!f.statuses.has(p.status)) return false;
    if (f.minPrice !== null && (p.price === null || p.price < f.minPrice)) return false;
    if (f.maxPrice !== null && (p.price === null || p.price > f.maxPrice)) return false;
    if (f.minSurface !== null && (p.surface === null || p.surface < f.minSurface)) return false;
    if (f.maxSurface !== null && (p.surface === null || p.surface > f.maxSurface)) return false;
    if (f.minRooms !== null && (p.rooms === null || p.rooms < f.minRooms)) return false;
    const ppm = perSqm(p);
    if (f.maxPricePerSqm !== null && (ppm === null || ppm > f.maxPricePerSqm)) return false;
    if (worst !== null) {
      const i = p.dpeClass ? DPE_ORDER.indexOf(p.dpeClass as (typeof DPE_ORDER)[number]) : -1;
      if (i < 0 || i > worst) return false;
    }
    for (const feature of f.features) if (!p.features.includes(feature)) return false;
    if (f.dealsOnly && p.position.kind !== "sous_marche") return false;
    if (f.mineOnly && !p.mine) return false;
    if (f.withPhotos && !p.photoId) return false;
    if (f.place && f.radiusKm !== null && distanceKm(f.place, p) > f.radiusKm) return false;
    return true;
  });
  const gap = (p: MapProperty) => (p.position.kind === "inconnu" ? Number.POSITIVE_INFINITY : p.position.gap);
  const nullsLast = (v: number | null, dir: 1 | -1) => (v === null ? Number.POSITIVE_INFINITY : v * dir);
  const by: Record<SortKey, (a: MapProperty, b: MapProperty) => number> = {
    affaires: (a, b) => gap(a) - gap(b),
    prix_asc: (a, b) => nullsLast(a.price, 1) - nullsLast(b.price, 1),
    prix_desc: (a, b) => nullsLast(a.price, -1) - nullsLast(b.price, -1),
    prix_m2: (a, b) => nullsLast(perSqm(a), 1) - nullsLast(perSqm(b), 1),
    surface: (a, b) => nullsLast(b.surface, 1) - nullsLast(a.surface, 1),
  };
  return kept.sort(by[f.sort]);
}

/** Polygone (64 côtés) d'un cercle de `km` autour d'un point, pour l'afficher sur la carte. */
export function circlePolygon(center: { lon: number; lat: number }, km: number): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * 2 * Math.PI;
    const dLat = (km / 6371) * (180 / Math.PI) * Math.sin(angle);
    const dLon = ((km / 6371) * (180 / Math.PI) * Math.cos(angle)) / Math.cos((center.lat * Math.PI) / 180);
    points.push([center.lon + dLon, center.lat + dLat]);
  }
  return points;
}

/** « 185 k€ », « 1,2 M€ » : prix court pour les étiquettes de la carte. */
export function shortPrice(price: number | null): string {
  if (price === null) return "Prix ?";
  if (price >= 1_000_000) return `${(price / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
  return `${Math.round(price / 1000)} k€`;
}
