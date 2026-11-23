import { describe, expect, it } from "vitest";
import { marketPosition, marketPositionLabel } from "./position";

const market = { median: 2500, sales: 120 };

describe("repère « bonne affaire » (prix affiché / médiane DVF de la commune)", () => {
  it("sous le marché à partir de 10 % sous la médiane", () => {
    const p = marketPosition({ price: 135_000, surface: 60 }, market); // 2 250 €/m², −10 %
    expect(p).toMatchObject({ kind: "sous_marche", median: 2500, sales: 120 });
    expect(marketPositionLabel(p)).toBe("Sous le marché (−10 %)");
  });
  it("dans le marché entre −10 % et +10 %, au-dessus au-delà", () => {
    expect(marketPositionLabel(marketPosition({ price: 156_000, surface: 60 }, market))).toBe("Dans le marché (+4 %)");
    expect(marketPositionLabel(marketPosition({ price: 180_000, surface: 60 }, market))).toBe("Au-dessus du marché (+20 %)");
  });
  it("jamais de verdict sans prix, sans surface ou avec trop peu de ventes", () => {
    expect(marketPosition({ price: null, surface: 60 }, market)).toEqual({ kind: "inconnu", reason: "prix_ou_surface" });
    expect(marketPosition({ price: 150_000, surface: 60 }, { median: 2500, sales: 9 })).toEqual({ kind: "inconnu", reason: "pas_assez_de_ventes" });
    expect(marketPosition({ price: 150_000, surface: 60 }, null)).toEqual({ kind: "inconnu", reason: "pas_assez_de_ventes" });
    expect(marketPositionLabel({ kind: "inconnu", reason: "pas_assez_de_ventes" })).toBe("Pas assez de ventes pour comparer");
  });
});
