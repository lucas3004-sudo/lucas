import { describe, expect, it } from "vitest";
import { sellerReportText, visitStats } from "./report";

const ctx = { visitDate: "21 novembre 2026", propertyLabel: "8 Boulevard du Port 80000 Amiens", agentName: "Inès Martin" };

describe("compte rendu de visite pour le vendeur", () => {
  it("assemble les réponses, sans l'identité de l'acquéreur", () => {
    const text = sellerReportText(
      { interest: "fort", priceOpinion: "eleve", nextStep: "offre", positives: "  luminosité,   balcon ", objections: "cuisine à refaire." },
      ctx,
    );
    expect(text).toBe(
      [
        "Bonjour,",
        "",
        "Voici le compte rendu de la visite du 21 novembre 2026 (8 Boulevard du Port 80000 Amiens).",
        "",
        "Les visiteurs se sont montrés très intéressés par votre bien.",
        "Points appréciés : luminosité, balcon.",
        "Réserves exprimées : cuisine à refaire.",
        "Ils trouvent le prix un peu élevé.",
        "Ils envisagent de faire une offre : je vous tiendrai au courant dès que possible.",
        "",
        "Bien cordialement,",
        "Inès Martin",
      ].join("\n"),
    );
  });

  it("omet les champs vides et l'avis sur le prix non donné", () => {
    const text = sellerReportText({ interest: "aucun", priceOpinion: null, nextStep: "abandon", positives: " ", objections: null }, { ...ctx, propertyLabel: null });
    expect(text).not.toMatch(/Points appréciés|Réserves|prix/);
    expect(text).toContain("Voici le compte rendu de la visite du 21 novembre 2026.");
    expect(text).toContain("Ils ne donneront pas suite.");
  });
});

describe("synthèse des visites d'un bien", () => {
  it("compte l'intérêt, les offres envisagées et les réserves sur le prix", () => {
    const s = visitStats([
      { interest: "fort", priceOpinion: "coherent", nextStep: "offre" },
      { interest: "moyen", priceOpinion: "trop_eleve", nextStep: "reflexion" },
      { interest: "faible", priceOpinion: "eleve", nextStep: "abandon" },
      { interest: "fort", priceOpinion: null, nextStep: "seconde_visite" },
    ]);
    expect(s).toEqual({ visits: 4, byInterest: { fort: 2, moyen: 1, faible: 1, aucun: 0 }, offersConsidered: 1, priceObjections: 2, priceOpinions: 3 });
    expect(visitStats([]).visits).toBe(0);
  });
});
