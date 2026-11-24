import { describe, expect, it } from "vitest";
import type { Property } from "../crm/data";
import { marketFacts, parseJsonObject, propertyFacts, readAnalysis, readListingDraft } from "./agent-prompts";

const property = {
  type: "Appartement", address_label: "8 Boulevard du Port 80000 Amiens", surface: 62, rooms: 3, price: 250000,
  dpe_class: "D", ges_class: "C", features: ["ascenseur", "cave"], is_copro: true, copro_lots: 24,
  notes: "Vendeur M. Martin, 06 12 34 56 78, pressé.", owner_user_id: "u1",
} as unknown as Property;

describe("données envoyées à l'IA par les agents (D-069)", () => {
  it("la fiche du bien ne contient ni la rue, ni le numéro, ni les notes (noms, téléphones)", () => {
    const facts = propertyFacts(property);
    expect(facts).toContain("Localisation : Amiens (80000)");
    expect(facts).toContain("Surface habitable : 62 m²");
    expect(facts).toContain("Équipements : Ascenseur, Cave");
    expect(facts).toContain("Copropriété de 24 lots");
    expect(facts).not.toMatch(/Boulevard|Port|8 /);
    expect(facts).not.toMatch(/Martin|06 12|pressé/);
  });

  it("le marché : fourchette DVF, ou un message clair quand les ventes manquent", () => {
    expect(marketFacts({ low: 230000, mid: 245000, high: 260000, comparables: 14 }, "2026-06-30")).toMatch(/14 ventes comparables, estimation entre 230\s000 € et 260\s000 €/);
    expect(marketFacts(null, null)).toContain("pas assez de ventes comparables");
  });
});

describe("lecture des réponses de l'IA", () => {
  it("JSON trouvé même entouré de texte ; rien d'utilisable sinon", () => {
    expect(parseJsonObject('Voici : {"titre": "T3", "description": "x"} merci')).toEqual({ titre: "T3", description: "x" });
    expect(parseJsonObject("pas de json")).toBeNull();
    expect(parseJsonObject("[1, 2]")).toBeNull();
  });

  it("annonce : titre et description bornés, description trop courte refusée", () => {
    const long = "Bel appartement lumineux au calme, proche des commerces et de la gare, avec cave et ascenseur.";
    expect(readListingDraft(JSON.stringify({ titre: "  T3 lumineux  ", description: long }))).toEqual({ title: "T3 lumineux", description: long });
    expect(readListingDraft(JSON.stringify({ titre: "x".repeat(300), description: long }))!.title).toHaveLength(120);
    expect(readListingDraft(JSON.stringify({ titre: "T3", description: "Court." }))).toBeNull();
    expect(readListingDraft("{}")).toBeNull();
  });

  it("analyse : verdict reconnu, ou « à relire » s'il sort de la liste", () => {
    expect(readAnalysis(JSON.stringify({ verdict: "Prix élevé", analyse: "Points forts…" }))).toEqual({ verdict: "prix élevé", analysis: "Points forts…" });
    expect(readAnalysis(JSON.stringify({ verdict: "excellent", analyse: "Texte" }))!.verdict).toBe("à relire");
    expect(readAnalysis(JSON.stringify({ verdict: "prix bas" }))).toBeNull();
  });
});
