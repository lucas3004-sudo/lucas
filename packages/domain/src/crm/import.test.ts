import { describe, expect, it } from "vitest";
import { decodeCsvBytes, detectSeparator, normalizeHeader, parseContactsCsv, parseFrenchDate, parseFrenchNumber, parsePropertiesCsv } from "./import";

describe("import CSV — lecture du fichier", () => {
  it("décode l'UTF-8 (BOM retiré) et, à défaut, le Windows-1252 d'Excel", () => {
    const utf8 = new TextEncoder().encode("﻿Prénom;Nom\nÉlodie;Dupré");
    expect(decodeCsvBytes(utf8)).toEqual({ text: "Prénom;Nom\nÉlodie;Dupré", encoding: "utf-8" });
    // « Prénom » en Windows-1252 : é = 0xE9 (octet invalide en UTF-8).
    const cp1252 = new Uint8Array([0x50, 0x72, 0xe9, 0x6e, 0x6f, 0x6d]);
    expect(decodeCsvBytes(cp1252)).toEqual({ text: "Prénom", encoding: "windows-1252" });
  });

  it("détecte le séparateur sur l'en-tête, sans compter les guillemets", () => {
    expect(detectSeparator("Nom;Prénom;E-mail\nA;B;C")).toBe(";");
    expect(detectSeparator("nom,prenom\nA,B")).toBe(",");
    expect(detectSeparator("nom\tprenom")).toBe("\t");
    expect(detectSeparator('"Nom, complet";Ville')).toBe(";");
  });

  it("reconnaît les en-têtes sans accents ni ponctuation et les nombres à la française", () => {
    expect(normalizeHeader("E-mail")).toBe("email");
    expect(normalizeHeader("Surface (m²)")).toBe("surfacem2");
    expect(parseFrenchNumber("250 000 €")).toBe(250_000);
    expect(parseFrenchNumber("62,5")).toBe(62.5);
    expect(parseFrenchNumber("250.000,00")).toBe(250_000);
    expect(parseFrenchNumber("")).toBeNull();
    expect(parseFrenchNumber("environ 60")).toBeNaN();
  });
});

describe("import CSV — contacts", () => {
  it("lit un export Excel français et signale chaque ligne invalide avec son numéro", () => {
    const csv = [
      "Prénom;Nom;Courriel;Téléphone;Type;Origine;Colonne inconnue",
      "Élodie;Dupré;elodie@test.invalid;06 12 34 56 78;Acheteur, Investisseur;Salon;x",
      ";Martin;pas-un-email;;Vendeur;;",
      "Paul;;paul@test.invalid;;;;",
      "Zoé;Bernard;;+33 7 00 00 00 01;astronaute;;",
    ].join("\n");
    const r = parseContactsCsv(csv);
    expect(r.fatal).toBeNull();
    expect(r.columns).toMatchObject({ prenom: "Prénom", email: "Courriel", telephone: "Téléphone", roles: "Type" });
    expect(r.unknownColumns).toEqual(["Colonne inconnue"]);
    expect(r.rows[0]).toEqual({
      line: 2,
      errors: [],
      data: { firstName: "Élodie", lastName: "Dupré", email: "elodie@test.invalid", phone: "06 12 34 56 78", roles: ["acquereur", "investisseur"], source: "Salon", notes: null },
    });
    expect(r.rows[1]).toMatchObject({ line: 3, data: null, errors: ["E-mail invalide : « pas-un-email »."] });
    expect(r.rows[2]).toMatchObject({ line: 4, data: null, errors: ["Nom manquant."] });
    expect(r.rows[3]!.errors[0]).toContain("Rôle inconnu : « astronaute »");
  });

  it("refuse un fichier sans colonne « Nom », vide ou trop long", () => {
    expect(parseContactsCsv("Prénom;Email\nA;a@b.fr").fatal).toBe("Colonne obligatoire absente : nom.");
    expect(parseContactsCsv("").fatal).toBe("Le fichier est vide.");
    expect(parseContactsCsv("Nom\n").fatal).toBe("Aucune ligne de données sous l'en-tête.");
    expect(parseContactsCsv(`Nom\n${"X\n".repeat(2001)}`).fatal).toContain("Trop de lignes (2001)");
  });
});

describe("import CSV — biens", () => {
  it("assemble l'adresse, convertit les valeurs et applique « sous mandat » par défaut", () => {
    const csv = [
      "Adresse,Code postal,Ville,Type de bien,Surface habitable,Pièces,Prix,DPE,Statut,Mandat,Équipements",
      '8 boulevard du Port,80000,Amiens,Appartement,"62,5",3,"250 000 €",d,,Exclusif,"balcon, parking"',
      "1 rue X,80000,Amiens,Local commercial,40,,,,,,",
      "2 rue Y,80000,Amiens,Maison,abc,,,H,vendu,,piscine",
    ].join("\n");
    const r = parsePropertiesCsv(csv);
    expect(r.fatal).toBeNull();
    expect(r.rows[0]).toEqual({
      line: 2,
      errors: [],
      data: {
        addressQuery: "8 boulevard du Port 80000 Amiens", type: "Appartement", surface: 62.5, rooms: 3, price: 250_000,
        dpeClass: "D", status: "mandat", mandateType: "exclusif", mandateNumber: null, mandateSignedOn: null, mandateEndsOn: null,
        features: ["balcon_terrasse", "stationnement"], notes: null,
      },
    });
    expect(r.rows[1]!.errors).toEqual(["Type de bien non pris en charge : « Local commercial » (appartement ou maison)."]);
    expect(r.rows[2]!.errors).toEqual(["Surface invalide : « abc ».", "Classe DPE invalide : « H » (A à G)."]);
  });

  it("exige les colonnes adresse et type", () => {
    expect(parsePropertiesCsv("Ville;Prix\nAmiens;1").fatal).toBe("Colonne obligatoire absente : adresse, type.");
  });

  it("reprend le numéro et les dates du mandat (formats français), et refuse les dates impossibles", () => {
    const csv = [
      "Adresse;Type;N° mandat;Date de mandat;Fin du mandat",
      "8 bd du Port 80000 Amiens;Appartement;M-2026-042;01/09/2026;01/12/2026",
      "2 place Gambetta 80000 Amiens;Maison;;31/02/2026;",
      "3 rue X 80000 Amiens;Maison;M-1;01/12/2026;2026-11-01",
    ].join("\n");
    const r = parsePropertiesCsv(csv);
    expect(r.rows[0]!.data).toMatchObject({ mandateNumber: "M-2026-042", mandateSignedOn: "2026-09-01", mandateEndsOn: "2026-12-01" });
    expect(r.rows[1]!.errors).toContain("Date de signature du mandat invalide : « 31/02/2026 » (JJ/MM/AAAA).");
    expect(r.rows[2]!.errors).toContain("La fin du mandat doit suivre sa signature.");
  });
});

describe("dates des fichiers CSV", () => {
  it("formats français et ISO ; dates inexistantes refusées", () => {
    expect(parseFrenchDate("21/11/2026")).toBe("2026-11-21");
    expect(parseFrenchDate("1-2-2027")).toBe("2027-02-01");
    expect(parseFrenchDate("21.11.2026")).toBe("2026-11-21");
    expect(parseFrenchDate("2026-11-21")).toBe("2026-11-21");
    expect(parseFrenchDate(" ")).toBeNull();
    expect(parseFrenchDate("29/02/2027")).toBe("invalide");
    expect(parseFrenchDate("29/02/2028")).toBe("2028-02-29");
    expect(parseFrenchDate("11/21/2026")).toBe("invalide"); // format américain
    expect(parseFrenchDate("demain")).toBe("invalide");
  });
});
