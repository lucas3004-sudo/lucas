import { describe, expect, it } from "vitest";
import type { MapProperty } from "./data";
import { applyFilters, circlePolygon, distanceKm, shortPrice, type MapFilters } from "./filters";

const base: MapFilters = {
  type: "tous", statuses: new Set(["mandat", "sous_offre"]), minPrice: null, maxPrice: null, minSurface: null, maxSurface: null,
  minRooms: null, maxPricePerSqm: null, worstDpe: null, features: new Set(), dealsOnly: false, mineOnly: false, withPhotos: false,
  place: null, radiusKm: null, sort: "affaires",
};
const amiens = { lon: 2.2957, lat: 49.8941 };
const prop = (id: string, over: Partial<MapProperty>): MapProperty => ({
  id, label: id, lon: amiens.lon, lat: amiens.lat, type: "Appartement", status: "mandat", price: 150_000, surface: 60, rooms: 3,
  dpeClass: "D", features: [], photoId: null, photoCount: 0, mine: true, position: { kind: "inconnu", reason: "pas_assez_de_ventes" }, ...over,
});

describe("critères de la carte", () => {
  const list = [
    prop("affaire", { price: 120_000, position: { kind: "sous_marche", gap: -0.2, median: 2500, sales: 50 }, features: ["balcon_terrasse"], photoId: "x", photoCount: 2 }),
    prop("cher", { price: 260_000, surface: 80, dpeClass: "F", position: { kind: "au_dessus", gap: 0.3, median: 2500, sales: 50 }, mine: false }),
    prop("maison-loin", { type: "Maison", price: 210_000, surface: 110, rooms: 5, lon: 2.53, lat: 49.65, features: ["jardin", "stationnement"] }),
    prop("vendu", { status: "vendu" }),
  ];
  it("statut, type, prix, surface, pièces", () => {
    expect(applyFilters(list, base).map((p) => p.id)).toEqual(["affaire", "cher", "maison-loin"]);
    expect(applyFilters(list, { ...base, type: "Maison" }).map((p) => p.id)).toEqual(["maison-loin"]);
    expect(applyFilters(list, { ...base, maxPrice: 200_000 }).map((p) => p.id)).toEqual(["affaire"]);
    expect(applyFilters(list, { ...base, minSurface: 70, maxSurface: 100 }).map((p) => p.id)).toEqual(["cher"]);
    expect(applyFilters(list, { ...base, minRooms: 4 }).map((p) => p.id)).toEqual(["maison-loin"]);
  });
  it("prix au m², DPE, équipements, bonnes affaires, mes biens, photos", () => {
    expect(applyFilters(list, { ...base, maxPricePerSqm: 2500 }).map((p) => p.id).sort()).toEqual(["affaire", "maison-loin"]);
    expect(applyFilters(list, { ...base, worstDpe: "D" }).map((p) => p.id)).toEqual(["affaire", "maison-loin"]);
    expect(applyFilters(list, { ...base, features: new Set(["jardin", "stationnement"]) }).map((p) => p.id)).toEqual(["maison-loin"]);
    expect(applyFilters(list, { ...base, dealsOnly: true }).map((p) => p.id)).toEqual(["affaire"]);
    expect(applyFilters(list, { ...base, mineOnly: true }).map((p) => p.id)).toEqual(["affaire", "maison-loin"]);
    expect(applyFilters(list, { ...base, withPhotos: true }).map((p) => p.id)).toEqual(["affaire"]);
  });
  it("lieu et rayon (la maison est à environ 31 km d'Amiens)", () => {
    expect(distanceKm(amiens, { lon: 2.53, lat: 49.65 })).toBeGreaterThan(30);
    expect(distanceKm(amiens, { lon: 2.53, lat: 49.65 })).toBeLessThan(33);
    expect(applyFilters(list, { ...base, place: amiens, radiusKm: 10 }).map((p) => p.id)).toEqual(["affaire", "cher"]);
    expect(applyFilters(list, { ...base, place: amiens, radiusKm: null }).length).toBe(3);
  });
  it("tris", () => {
    expect(applyFilters(list, { ...base, sort: "prix_asc" }).map((p) => p.id)).toEqual(["affaire", "maison-loin", "cher"]);
    expect(applyFilters(list, { ...base, sort: "prix_desc" }).map((p) => p.id)).toEqual(["cher", "maison-loin", "affaire"]);
    expect(applyFilters(list, { ...base, sort: "prix_m2" }).map((p) => p.id)).toEqual(["maison-loin", "affaire", "cher"]);
    expect(applyFilters(list, { ...base, sort: "surface" }).map((p) => p.id)).toEqual(["maison-loin", "cher", "affaire"]);
  });
  it("prix courts et cercle du rayon", () => {
    expect(shortPrice(185_000)).toBe("185 k€");
    expect(shortPrice(1_250_000)).toBe("1,3 M€");
    expect(shortPrice(null)).toBe("Prix ?");
    const ring = circlePolygon(amiens, 5);
    expect(ring).toHaveLength(65);
    for (const [lon, lat] of ring.slice(0, 64)) expect(distanceKm(amiens, { lon, lat })).toBeCloseTo(5, 1);
  });
});
