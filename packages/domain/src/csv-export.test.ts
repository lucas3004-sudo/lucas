import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";

describe("écriture CSV (export de l'agence)", () => {
  it("guillemets, retours à la ligne, nombres français, valeurs vides", () => {
    const csv = toCsv([
      ["Nom", "Notes", "Prix"],
      ["Dupré; Élodie", 'Dit "pressée"\nRappeler', 250000.5],
      ["Martin", null, undefined],
    ]);
    expect(csv).toBe('Nom;Notes;Prix\r\n"Dupré; Élodie";"Dit ""pressée""\nRappeler";250000,5\r\nMartin;;\r\n');
    // Relu à l'identique par notre propre lecteur (aller-retour avec l'import).
    expect(parseCsv(csv, ";")[1]).toEqual(["Dupré; Élodie", 'Dit "pressée"\nRappeler', "250000,5"]);
  });

  it("neutralise les formules (injection CSV) dans les cellules de texte, pas dans les nombres", () => {
    expect(toCsv([["=HYPERLINK(\"http://x\")", "+33 6 11", "-2", "@SUM(A1)", "\tx"]])).toBe(
      `"'=HYPERLINK(""http://x"")";'+33 6 11;'-2;'@SUM(A1);'\tx\r\n`,
    );
    expect(toCsv([[-2]])).toBe("-2\r\n");
  });
});
