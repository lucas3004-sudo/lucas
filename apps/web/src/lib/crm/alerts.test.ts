import type { MatchProfile, MatchProperty } from "@immopilot/domain";
import { describe, expect, it } from "vitest";
import { matchesByOwner } from "./alerts";

const property: MatchProperty = { type: "Appartement", price: 200_000, surface: 60, rooms: 3, inseeCode: "80021", features: [] };
const profile = (over: Partial<MatchProfile> = {}): MatchProfile => ({
  types: ["Appartement"], budgetMax: 220_000, surfaceMin: 50, roomsMin: 3, inseeCodes: ["80021"], features: [], ...over,
});

describe("matchesByOwner", () => {
  it("regroupe par responsable : meilleur score et nombre de profils au-dessus du seuil", () => {
    const r = matchesByOwner(
      property,
      [
        { ownerUserId: "ines", profile: profile() },
        { ownerUserId: "ines", profile: profile({ roomsMin: 4 }) }, // pièces : 0,5 → 95 %
        { ownerUserId: "paul", profile: profile({ inseeCodes: ["75056"] }) }, // hors secteur → 75 %
      ],
      "hugo",
    );
    expect(r).toEqual([
      { ownerUserId: "ines", best: 100, count: 2 },
      { ownerUserId: "paul", best: 75, count: 1 },
    ]);
  });

  it("n'alerte pas l'auteur du bien, ni sous le seuil, ni pour un autre type de bien", () => {
    const r = matchesByOwner(
      property,
      [
        { ownerUserId: "hugo", profile: profile() },
        { ownerUserId: "ines", profile: profile({ inseeCodes: ["75056"], budgetMax: 150_000 }) }, // 40 %
        { ownerUserId: "paul", profile: profile({ types: ["Maison"] }) },
      ],
      "hugo",
    );
    expect(r).toEqual([]);
  });
});
