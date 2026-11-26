import { describe, expect, it } from "vitest";
import { decodeCsvBytes } from "../crm/import";
import { parsePolirisCsv } from "../crm/poliris";
import { encodeWindows1252, POLIRIS_FIELD_COUNT, polirisCsv, polirisFields, polirisLine, polirisValue, type PolirisListing } from "./poliris-export";

const listing: PolirisListing = {
  agencyCode: "agence-test", reference: "M-2026-042", technicalId: "8f8a2c4e1111422283339444",
  type: "Appartement", street: "8 Boulevard du Port", postcode: "80000", city: "Amiens", price: 250000, feesPayer: "acquereur", feesPercent: 5, priceExcludingFees: 238095,
  surface: 62.5, rooms: 3, title: "Appartement 3 pièces lumineux", description: "Bel appartement.\nProche \"gare\".",
  features: ["ascenseur", "balcon_terrasse", "stationnement"], exclusive: true, dpeClass: "D", gesClass: "C",
  isCopro: true, coproLots: 24, coproAnnualCharges: 1800, photos: ["M-2026-042-1.jpg", "M-2026-042-2.jpg"],
};

describe("export Poliris (format SeLoger 4.09, D-070)", () => {
  it("329 champs, aux rangs de la spécification", () => {
    const f = polirisFields(listing);
    expect(f).toHaveLength(POLIRIS_FIELD_COUNT);
    const at = (rank: number) => f[rank - 1];
    expect([at(1), at(2), at(3), at(4), at(5), at(6), at(7)]).toEqual(["agence-test", "M-2026-042", "Vente", "Appartement", "80000", "Amiens", "France"]);
    expect([at(11), at(15), at(16), at(18), at(20)]).toEqual(["250000", "5", "62.5", "3", "Appartement 3 pièces lumineux"]);
    expect(at(21)).toBe("Bel appartement.<BR>Proche 'gare'.");
    expect([at(41), at(42), at(43), at(48), at(83)]).toEqual(["OUI", "NON", "1", "OUI", "OUI"]);
    expect([at(85), at(86), at(87)]).toEqual(["M-2026-042-1.jpg", "M-2026-042-2.jpg", ""]);
    expect([at(175), at(177), at(179), at(258), at(259), at(260)]).toEqual(["8f8a2c4e1111422283339444", "D", "C", "OUI", "24", "1800"]);
    expect([at(301), at(302), at(303)]).toEqual(["4.09", "1", "238095"]);
    expect(at(8)).toBe("8 Boulevard du Port");
  });

  it("honoraires à la charge du vendeur : ni pourcentage ni prix hors honoraires", () => {
    const f = polirisFields({ ...listing, feesPayer: "vendeur" });
    expect([f[14], f[301], f[302]]).toEqual(["", "2", ""]);
  });

  it("valeurs nettoyées : guillemets, sauts de ligne, balises", () => {
    expect(polirisValue('Dit "calme"\r\n<b>gras</b> <BR>')).toBe("Dit 'calme'<BR>gras <BR>");
    expect(polirisValue(null)).toBe("");
  });

  it("aller-retour : l'export est relu par l'import Poliris d'ImmoPilot", () => {
    const csv = polirisCsv([listing, { ...listing, reference: "M-2", type: "Maison" }]);
    expect(csv.split("\r\n")).toHaveLength(3);
    const bytes = encodeWindows1252(csv);
    const { text, encoding } = decodeCsvBytes(bytes);
    expect(encoding).toBe("windows-1252");
    const { rows } = parsePolirisCsv(text);
    expect(rows.map((r) => r.data?.type)).toEqual(["Appartement", "Maison"]);
    expect(rows[0]!.data).toMatchObject({ addressQuery: "8 Boulevard du Port 80000 Amiens", price: 250000, surface: 62.5, rooms: 3, dpeClass: "D", mandateType: "exclusif", listingTitle: "Appartement 3 pièces lumineux" });
    expect(polirisLine(listing).startsWith('"agence-test"!#"M-2026-042"!#"Vente"')).toBe(true);
  });

  it("encodage Windows-1252 : accents et symbole euro conservés", () => {
    expect(Array.from(encodeWindows1252("é€’"))).toEqual([0xe9, 0x80, 0x92]);
    expect(Array.from(encodeWindows1252("😀"))).toEqual([0x3f]);
  });
});
