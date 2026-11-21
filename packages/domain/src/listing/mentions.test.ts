import { describe, expect, it } from "vitest";
import { buildListingText, checkListing, EXCESSIVE_CONSUMPTION_MENTION, GEORISQUES_MENTION, isPublishable, priceExcludingFees, type ListingInput } from "./mentions";

const complete: ListingInput = {
  type: "Appartement", city: "Amiens", postcode: "80000", surface: 62, rooms: 3, price: 250_000,
  dpeClass: "D", gesClass: "C", energyCostLow: 1_100, energyCostHigh: 1_540, energyCostYear: 2025,
  isCopro: true, coproLots: 24, coproAnnualCharges: 1_800, coproProcedure: null,
  feesPayer: "acquereur", feesPercent: 5, feeScheduleUrl: "https://agence.example/honoraires",
  title: null, description: "Lumineux, au calme, proche de la gare.",
};

describe("contrôle des mentions obligatoires", () => {
  it("annonce complète : toutes les mentions sont présentes", () => {
    const checks = checkListing(complete);
    expect(checks.map((c) => c.status)).toEqual(["ok", "ok", "ok", "ok", "ok", "ok", "ok"]);
    expect(isPublishable(checks)).toBe(true);
  });

  it("signale chaque mention manquante avec ce qu'il faut renseigner", () => {
    const checks = checkListing({ ...complete, gesClass: null, energyCostYear: null, isCopro: null, feesPayer: "acquereur", feesPercent: null, feeScheduleUrl: null });
    const missing = checks.filter((c) => c.status === "manquante").map((c) => c.key);
    expect(missing).toEqual(["dpe", "depenses_energie", "copropriete", "honoraires", "bareme"]);
    expect(isPublishable(checks)).toBe(false);
  });

  it("copropriété : lots et charges exigés ; hors copropriété : rien de plus", () => {
    expect(checkListing({ ...complete, coproLots: null }).find((c) => c.key === "copropriete")?.status).toBe("manquante");
    expect(checkListing({ ...complete, isCopro: false, coproLots: null, coproAnnualCharges: null }).find((c) => c.key === "copropriete")?.status).toBe("ok");
  });

  it("fourchette de dépenses incohérente (basse > haute) refusée", () => {
    expect(checkListing({ ...complete, energyCostLow: 2_000, energyCostHigh: 1_000 }).find((c) => c.key === "depenses_energie")?.status).toBe("manquante");
  });
});

describe("texte de l'annonce", () => {
  it("prix hors honoraires : 250 000 € à 5 % → 238 095 €", () => {
    expect(priceExcludingFees(250_000, 5)).toBe(238_095);
  });

  it("reprend les données sans les modifier et ajoute les mentions", () => {
    const text = buildListingText(complete);
    expect(text.startsWith("Appartement 3 pièces – 62 m² – Amiens\n\nLumineux, au calme, proche de la gare.")).toBe(true);
    expect(text).toContain("Prix : 250 000 € honoraires inclus, dont 5 % TTC d'honoraires à la charge de l'acquéreur (238 095 € hors honoraires).");
    expect(text).toContain("classe énergie D, classe climat C");
    expect(text).toContain("entre 1 100 € et 1 540 € par an");
    expect(text).toContain("Nombre de lots : 24. Montant moyen annuel des charges : 1 800 €.");
    expect(text).toContain("Barème des honoraires : https://agence.example/honoraires");
    expect(text.endsWith(GEORISQUES_MENTION)).toBe(true);
    expect(text).not.toContain(EXCESSIVE_CONSUMPTION_MENTION);
  });

  it("classe F ou G : mention de consommation excessive ; honoraires vendeur", () => {
    const text = buildListingText({ ...complete, dpeClass: "G", feesPayer: "vendeur", feesPercent: null, isCopro: false, title: "Maison à rénover" });
    expect(text.startsWith("Maison à rénover")).toBe(true);
    expect(text).toContain(EXCESSIVE_CONSUMPTION_MENTION);
    expect(text).toContain("Prix : 250 000 €. Honoraires à la charge du vendeur.");
    expect(text).not.toContain("copropriété");
  });
});
