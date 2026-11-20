import type { MatchProfile, MatchProperty } from "@immopilot/domain";
import { describe, expect, it } from "vitest";
import { propertiesWithoutBuyer } from "./unmatched";

const flat = (id: string, over: Partial<MatchProperty> = {}) => ({
  id,
  m: { type: "Appartement", price: 200_000, surface: 60, rooms: 3, inseeCode: "80021", features: [], ...over } as MatchProperty,
});
const profile = (over: Partial<MatchProfile> = {}): MatchProfile => ({
  types: ["Appartement"], budgetMax: 220_000, surfaceMin: 50, roomsMin: 3, inseeCodes: ["80021"], features: [], ...over,
});

describe("propertiesWithoutBuyer", () => {
  it("écarte un bien qui a un acquéreur à 100 %", () => {
    expect(propertiesWithoutBuyer([flat("a")], [profile()], (p) => p.m)).toEqual([]);
  });

  it("signale un bien sans aucun profil compatible (meilleur score : aucun)", () => {
    const rows = propertiesWithoutBuyer([flat("maison", { type: "Maison" })], [profile()], (p) => p.m);
    expect(rows).toEqual([{ property: flat("maison", { type: "Maison" }), bestScore: null }]);
  });

  it("signale un bien dont le meilleur score reste sous le seuil, avec ce score", () => {
    // Hors secteur (0/25) et budget dépassé de plus de 10 % (0/35) : 40 / 100.
    const rows = propertiesWithoutBuyer([flat("loin", { inseeCode: "75056", price: 300_000 })], [profile()], (p) => p.m);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.bestScore).toBe(40);
  });

  it("sans aucun profil actif, tous les biens sont signalés", () => {
    expect(propertiesWithoutBuyer([flat("a"), flat("b")], [], (p) => p.m).map((r) => r.bestScore)).toEqual([null, null]);
  });
});
