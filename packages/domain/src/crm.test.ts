import { describe, expect, it } from "vitest";
import { findDuplicates, normalizeEmail, normalizeName, normalizePhone } from "./crm/duplicates";
import { DEFAULT_WEIGHTS, matchProperty, type MatchProfile, type MatchProperty } from "./matching/match";

// Données SYNTHÉTIQUES de test.
const property: MatchProperty = { type: "Appartement", price: 180_000, surface: 62, rooms: 3, inseeCode: "80021", features: ["ascenseur", "cave"] };
const profile: MatchProfile = { types: ["Appartement"], budgetMax: 200_000, surfaceMin: 55, roomsMin: 3, inseeCodes: ["80021"], features: ["ascenseur"] };

describe("matching", () => {
  it("un bien qui remplit tous les critères obtient 100", () => {
    const r = matchProperty(property, profile);
    expect(r.compatible && r.score).toBe(100);
  });

  it("un type différent est incompatible, avec la raison", () => {
    const r = matchProperty({ ...property, type: "Maison" }, profile);
    expect(r.compatible).toBe(false);
    if (!r.compatible) expect(r.reason).toContain("appartement");
  });

  it("budget dépassé de 5 % : critère partiel (note 0,5) ; de 10 % ou plus : non", () => {
    const r5 = matchProperty({ ...property, price: 210_000 }, profile);
    const r10 = matchProperty({ ...property, price: 220_000 }, profile);
    if (!r5.compatible || !r10.compatible) throw new Error("incompatible");
    expect(r5.criteria.find((c) => c.key === "budget")).toMatchObject({ satisfaction: "partiel", score: 0.5 });
    expect(r10.criteria.find((c) => c.key === "budget")).toMatchObject({ satisfaction: "non", score: 0 });
    // Pondérations par défaut : budget 35 sur 100 → 100 − 35 × 0,5 = 82,5 → 83 (arrondi).
    expect(r5.score).toBe(83);
    expect(r10.score).toBe(65);
  });

  it("les pondérations sont modifiables", () => {
    const r = matchProperty({ ...property, price: 220_000 }, profile, { ...DEFAULT_WEIGHTS, budget: 0 });
    expect(r.compatible && r.score).toBe(100);
  });

  it("une donnée absente du bien est « inconnue », exclue du calcul et signalée à vérifier", () => {
    const r = matchProperty({ ...property, rooms: null }, profile);
    if (!r.compatible) throw new Error("incompatible");
    expect(r.toVerify).toEqual(["pieces"]);
    expect(r.score).toBe(100);
  });

  it("équipements : note proportionnelle et liste des manques", () => {
    const r = matchProperty({ ...property, features: [] }, { ...profile, features: ["ascenseur", "balcon_terrasse"] });
    if (!r.compatible) throw new Error("incompatible");
    expect(r.criteria.find((c) => c.key === "equipements")).toMatchObject({ score: 0, detail: "Manque : ascenseur, balcon ou terrasse." });
  });

  it("hors secteur : localisation non remplie", () => {
    const r = matchProperty({ ...property, inseeCode: "80001" }, profile);
    if (!r.compatible) throw new Error("incompatible");
    expect(r.criteria.find((c) => c.key === "localisation")?.satisfaction).toBe("non");
    expect(r.score).toBe(75);
  });
});

describe("doublons de contacts", () => {
  it("normalise e-mails, téléphones et noms", () => {
    expect(normalizeEmail("  Jean.Dupont@Exemple.FR ")).toBe("jean.dupont@exemple.fr");
    expect(normalizePhone("+33 6 12 34 56 78")).toBe("0612345678");
    expect(normalizePhone("06.12.34.56.78")).toBe("0612345678");
    expect(normalizePhone("12")).toBeNull();
    expect(normalizeName("Élodie", "Lefèvre-Durand")).toBe("elodie lefevre durand");
  });

  it("détecte par e-mail, téléphone ou nom complet, avec les raisons", () => {
    const existing = [
      { id: "a", firstName: "Jean", lastName: "Dupont", email: "jean@x.fr", phone: null },
      { id: "b", firstName: "Marie", lastName: "Martin", email: null, phone: "0612345678" },
      { id: "c", firstName: "Paul", lastName: "Durand", email: null, phone: null },
    ];
    expect(findDuplicates({ firstName: "J.", lastName: "D", email: "JEAN@x.fr", phone: null }, existing)).toEqual([{ id: "a", reasons: ["email"] }]);
    expect(findDuplicates({ firstName: "M", lastName: null, email: null, phone: "+33612345678" }, existing)).toEqual([{ id: "b", reasons: ["telephone"] }]);
    expect(findDuplicates({ firstName: "paul", lastName: "DURAND", email: null, phone: null }, existing)).toEqual([{ id: "c", reasons: ["nom"] }]);
    expect(findDuplicates({ firstName: "Inconnu", lastName: "Total", email: null, phone: null }, existing)).toEqual([]);
  });
});
