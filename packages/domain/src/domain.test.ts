import { describe, expect, it } from "vitest";
import { csvRecords, parseCsv } from "./csv";
import { cleanDvf, cleanMutation, type DvfLine } from "./dvf/clean";
import { quantileInclusive, summarize } from "./stats";
import { confidenceLevel, estimateRange, lookbackStart, roundEuros, withinSurfaceRange, type Comparable } from "./valuation/estimate";

// Données SYNTHÉTIQUES construites pour les tests (aucune vente réelle).
function line(partial: Partial<DvfLine>): DvfLine {
  return {
    id_mutation: "M1", date_mutation: "2025-03-01", nature_mutation: "Vente", valeur_fonciere: "200000",
    code_commune: "80021", id_parcelle: "P1", lot1_numero: "", type_local: "Appartement",
    surface_reelle_bati: "50", nombre_pieces_principales: "2", nature_culture: "", surface_terrain: "",
    longitude: "2.29", latitude: "49.89", ...partial,
  };
}

describe("statistiques", () => {
  it("quartiles inclusifs (comme QUARTILE.INCLUS et le prototype Python)", () => {
    const s = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(quantileInclusive(s, 0.25)).toBeCloseTo(2.75);
    expect(quantileInclusive(s, 0.5)).toBeCloseTo(4.5);
    expect(quantileInclusive(s, 0.75)).toBeCloseTo(6.25);
  });
  it("dispersion = (Q3 − Q1) / médiane", () => {
    expect(summarize([100, 100, 100]).dispersion).toBe(0);
    expect(summarize([1, 2, 3, 4, 5, 6, 7, 8]).dispersion).toBeCloseTo(3.5 / 4.5);
  });
});

describe("CSV", () => {
  it("gère guillemets, virgules internes, guillemets doublés et fins de ligne Windows", () => {
    expect(parseCsv('a,b\r\n"x, y","il dit ""oui"""\r\n')).toEqual([["a", "b"], ["x, y", 'il dit "oui"']]);
  });
  it("produit des objets à partir de l'en-tête, avec un séparateur point-virgule", () => {
    expect(csvRecords("CODGEO;ZONE\n80021;B1\n", ";")).toEqual([{ CODGEO: "80021", ZONE: "B1" }]);
  });
});

describe("nettoyage DVF (règles R1 à R5)", () => {
  it("R1 : exclut une adjudication, garde une VEFA comme « neuf »", () => {
    expect(cleanMutation([line({ nature_mutation: "Adjudication" })])).toEqual({ excluded: "R1" });
    const vefa = cleanMutation([line({ nature_mutation: "Vente en l'état futur d'achèvement" })]);
    expect("sale" in vefa && vefa.sale.nature).toBe("neuf");
  });

  it("R2 : un local répété sur plusieurs lignes (cultures) ne compte qu'une fois, le terrain s'additionne", () => {
    const result = cleanMutation([
      line({ type_local: "Maison", surface_reelle_bati: "100", nature_culture: "sols", surface_terrain: "300" }),
      line({ type_local: "Maison", surface_reelle_bati: "100", nature_culture: "jardins", surface_terrain: "200" }),
    ]);
    expect("sale" in result).toBe(true);
    if ("sale" in result) {
      expect(result.sale.pricePerSqm).toBe(2000);
      expect(result.sale.landSurface).toBe(500);
    }
  });

  it("R3 : exclut une vente de deux appartements (prix au m² sans signification)", () => {
    const result = cleanMutation([
      line({ lot1_numero: "1", surface_reelle_bati: "40" }),
      line({ lot1_numero: "2", surface_reelle_bati: "60" }),
    ]);
    expect(result).toEqual({ excluded: "R3" });
  });

  it("R3 : garde un appartement vendu avec sa cave (dépendance)", () => {
    const result = cleanMutation([line({}), line({ type_local: "Dépendance", surface_reelle_bati: "" })]);
    expect("sale" in result).toBe(true);
  });

  it("R3 : exclut une vente avec un local commercial", () => {
    expect(cleanMutation([line({}), line({ type_local: "Local industriel. commercial ou assimilé" })])).toEqual({ excluded: "R3" });
  });

  it("R4 : exclut une surface inférieure à 9 m² ou une valeur absente", () => {
    expect(cleanMutation([line({ surface_reelle_bati: "8" })])).toEqual({ excluded: "R4" });
    expect(cleanMutation([line({ valeur_fonciere: "" })])).toEqual({ excluded: "R4" });
  });

  it("R5 : écarte un prix au m² aberrant dans un groupe suffisant", () => {
    const lines: DvfLine[] = [];
    for (let i = 0; i < 12; i++) lines.push(line({ id_mutation: `M${i}`, valeur_fonciere: String(100000 + i * 2000) }));
    lines.push(line({ id_mutation: "X", valeur_fonciere: "1000000" })); // 20 000 €/m², très au-dessus du groupe
    const report = cleanDvf(lines);
    expect(report.mutations).toBe(13);
    expect(report.exclusions.R5).toBe(1);
    expect(report.sales.find((s) => s.mutationId === "X")).toBeUndefined();
  });
});

describe("estimation indicative", () => {
  const comps = (prices: number[]): Comparable[] =>
    prices.map((p, i) => ({ mutationId: `C${i}`, date: "2025-01-01", price: p * 50, surface: 50, pricePerSqm: p, distanceM: 100 }));

  it("refuse d'estimer avec moins de 3 comparables", () => {
    expect(estimateRange(50, comps([2000, 2100]))).toEqual({ status: "insuffisant", comparables: 2, minimum: 3 });
  });

  it("donne toujours une fourchette arrondie au millier", () => {
    const e = estimateRange(60, comps([2000, 2200, 2400, 2600, 2800]));
    expect(e.status).toBe("ok");
    if (e.status === "ok") {
      expect(e.low).toBe(roundEuros(2200 * 60));
      expect(e.mid).toBe(roundEuros(2400 * 60));
      expect(e.high).toBe(roundEuros(2600 * 60));
      expect(e.low).toBeLessThan(e.high);
      expect(e.confidence).toBe("faible"); // moins de 8 comparables
    }
  });

  it("niveaux de confiance", () => {
    expect(confidenceLevel(25, 0.2)).toBe("elevee");
    expect(confidenceLevel(12, 0.35)).toBe("moyenne");
    expect(confidenceLevel(30, 0.6)).toBe("faible");
    expect(confidenceLevel(5, 0.1)).toBe("faible");
  });

  it("garde les comparables de surface comprise entre la moitié et une fois et demie", () => {
    expect(withinSurfaceRange(60, 30)).toBe(true);
    expect(withinSurfaceRange(60, 29)).toBe(false);
    expect(withinSurfaceRange(60, 90)).toBe(true);
    expect(withinSurfaceRange(60, 91)).toBe(false);
  });

  it("fenêtre de 24 mois comptée depuis la vente la plus récente", () => {
    expect(lookbackStart("2025-12-31")).toBe("2023-12-31");
  });
});
