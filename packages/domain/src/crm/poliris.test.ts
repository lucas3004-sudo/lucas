import { describe, expect, it } from "vitest";
import { isPolirisText, parsePolirisCsv } from "./poliris";

/** Une annonce au format Poliris : 301 champs, les rangs utiles renseignés (spécification 4.09). */
function line(values: Record<number, string>): string {
  const fields = Array.from({ length: 301 }, (_, i) => values[i + 1] ?? "");
  return fields.map((v) => `"${v}"`).join("!#");
}
const sale = {
  1: "monagence", 2: "VE950", 3: "Vente", 4: "Appartement", 5: "80000", 6: "AMIENS", 8: "8 boulevard du Port",
  11: "250000", 16: "62.5", 18: "3", 20: "Appartement 3 pièces lumineux", 21: "Très bel appartement.<BR>Proche gare.",
  39: "1", 41: "OUI", 42: "NON", 43: "1", 83: "OUI", 177: "D",
};

describe("import de l'export Poliris (D-068)", () => {
  it("reconnaît le format (et pas un CSV ordinaire)", () => {
    expect(isPolirisText(line(sale))).toBe(true);
    expect(isPolirisText("\uFEFF" + line(sale))).toBe(true);
    expect(isPolirisText("adresse;ville;prix\n8 rue X;Amiens;200000")).toBe(false);
  });

  it("une vente d'appartement devient un bien sous mandat, avec son annonce", () => {
    const { rows, fatal } = parsePolirisCsv(line(sale));
    expect(fatal).toBeNull();
    expect(rows[0]!.errors).toEqual([]);
    expect(rows[0]!.data).toMatchObject({
      addressQuery: "8 boulevard du Port 80000 AMIENS", type: "Appartement", surface: 62.5, rooms: 3, price: 250000,
      dpeClass: "D", status: "mandat", mandateType: "exclusif", features: ["ascenseur", "balcon_terrasse", "stationnement"],
      listingTitle: "Appartement 3 pièces lumineux", listingDescription: "Très bel appartement.\nProche gare.",
    });
    expect(rows[0]!.data!.notes).toContain("référence VE950");
  });

  it("maison/villa reconnue ; DPE vierge ignoré ; mandat simple par défaut", () => {
    const { rows } = parsePolirisCsv(line({ ...sale, 4: "Maison/villa", 177: "VI", 83: "NON" }));
    expect(rows[0]!.data).toMatchObject({ type: "Maison", dpeClass: null, mandateType: "simple" });
  });

  it("locations, autres types et annonces sans adresse : écartées avec une explication", () => {
    const { rows } = parsePolirisCsv([line({ ...sale, 3: "Location" }), line({ ...sale, 4: "Parking/box" }), line({ ...sale, 8: "" })].join("\r\n"));
    expect(rows.map((r) => r.data)).toEqual([null, null, null]);
    expect(rows[0]!.errors[0]).toContain("n'est pas une vente");
    expect(rows[1]!.errors[0]).toContain("non géré");
    expect(rows[2]!.errors[0]).toContain("adresse absente");
    expect(rows.map((r) => r.line)).toEqual([1, 2, 3]);
  });

  it("fichier vide ou ligne tronquée", () => {
    expect(parsePolirisCsv("").fatal).toBe("Le fichier est vide.");
    expect(parsePolirisCsv('"a"!#"b"!#"c"').rows[0]!.errors[0]).toContain("Ligne incomplète");
  });
});
