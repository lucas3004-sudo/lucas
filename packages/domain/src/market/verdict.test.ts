import { describe, expect, it } from "vitest";
import { listingVerdict } from "./verdict";

const position = { kind: "sous_marche" as const, gap: -0.23, median: 2527, sales: 1916 };
const estimate = { low: 138_000, mid: 150_000, high: 162_000, comparables: 24 };
const rent = { monthlyLow: 620, monthlyHigh: 760, millesime: 2025 };
// Les nombres français utilisent une espace insécable fine : on la ramène à une espace pour comparer.
const plain = (s: string | undefined) => (s ?? "").replace(/[\u202f\u00a0]/g, " ");

describe("verdict d'une annonce (sans IA)", () => {
  it("bonne affaire : prix sous la fourchette, raisons chiffrées et rendement", () => {
    const r = listingVerdict({ price: 120_000, surface: 62, estimate, position, rent, city: "Amiens" });
    expect(r.verdict).toBe("bonne_affaire");
    expect(r.gapToEstimate).toBe(-0.2);
    expect(plain(r.reasons[0])).toBe("Prix sous la fourchette estimée (138 000 € – 162 000 €), établie sur 24 ventes comparables autour du bien (−20 % par rapport au milieu).");
    expect(plain(r.reasons[1])).toBe("Prix au m² : 1 935 € contre 2 527 € de médiane à Amiens (−23 %, 1 916 ventes sur 24 mois).");
    expect(r.grossYield!.low).toBeCloseTo(0.062, 3);
    expect(plain(r.reasons[2])).toBe("Rendement locatif brut estimé : 6,2 % à 7,6 % (loyer de 620 € à 760 € par mois, indicateurs ANIL 2025).");
  });
  it("prix élevé au-dessus de la fourchette ; cohérent dedans", () => {
    expect(listingVerdict({ price: 175_000, surface: 62, estimate, position: { ...position, kind: "au_dessus", gap: 0.12 }, rent: null, city: null }).verdict).toBe("prix_eleve");
    expect(listingVerdict({ price: 150_000, surface: 62, estimate, position: { ...position, kind: "dans_marche", gap: -0.04 }, rent: null, city: null }).verdict).toBe("prix_coherent");
  });
  it("dans le bas d'une fourchette large mais 18 % sous son milieu : bonne affaire (cas réel d'Amiens)", () => {
    const wide = { low: 118_000, mid: 147_000, high: 176_000, comparables: 85 };
    const r = listingVerdict({ price: 120_000, surface: 62, estimate: wide, position, rent: null, city: "Amiens" });
    expect(r.verdict).toBe("bonne_affaire");
    expect(plain(r.reasons[0])).toBe("Prix dans le bas de la fourchette estimée (118 000 € – 176 000 €), −18 % par rapport à son milieu, établie sur 85 ventes comparables autour du bien.");
    expect(listingVerdict({ price: 168_000, surface: 62, estimate: wide, position, rent: null, city: null }).verdict).toBe("prix_eleve");
  });
  it("sans fourchette, la médiane de la commune décide ; sans rien, analyse incomplète", () => {
    expect(listingVerdict({ price: 120_000, surface: 62, estimate: null, position, rent: null, city: "Amiens" }).verdict).toBe("bonne_affaire");
    const none = listingVerdict({ price: 120_000, surface: 62, estimate: null, position: { kind: "inconnu", reason: "pas_assez_de_ventes" }, rent: null, city: null });
    expect(none).toMatchObject({ verdict: "incomplet", reasons: ["Pas assez de ventes réelles autour du bien pour le comparer au marché."] });
    expect(listingVerdict({ price: null, surface: 62, estimate, position, rent, city: null }).verdict).toBe("incomplet");
  });
});
