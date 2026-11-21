import { describe, expect, it } from "vitest";
import { checkQuota, monthlyPrice, PLANS, quotaMessage } from "./plans";

describe("formules et quotas (D-014)", () => {
  it("reprend la grille validée : prix et quotas", () => {
    expect([PLANS.investisseur.priceEur, PLANS.solo.priceEur, PLANS.pro.priceEur, PLANS.agency.priceEur]).toEqual([19, 59, 99, 249]);
    expect(PLANS.solo.quotas).toEqual({ dossiers: 40, copilot: 200, annonces_ia: 30, contacts: 1000, membres: 1 });
    expect(PLANS.agency.quotas.contacts).toBeNull(); // contacts illimités
    expect(PLANS.essai.quotas.copilot).toBe(0); // pas d'IA pendant l'essai (D-047)
  });

  it("autorise jusqu'au quota inclus, refuse au-delà", () => {
    expect(checkQuota(PLANS.solo, "dossiers", 39)).toEqual({ allowed: true, used: 39, limit: 40, remaining: 1 });
    expect(checkQuota(PLANS.solo, "dossiers", 40)).toEqual({ allowed: false, used: 40, limit: 40, remaining: 0 });
    expect(checkQuota(PLANS.solo, "contacts", 990, 20).allowed).toBe(false); // import de 20 contacts
    expect(checkQuota(PLANS.agency, "contacts", 1_000_000)).toEqual({ allowed: true, used: 1_000_000, limit: null, remaining: null });
  });

  it("Agency : 3 membres inclus, plus les membres supplémentaires payés", () => {
    expect(checkQuota(PLANS.agency, "membres", 3).allowed).toBe(false);
    expect(checkQuota(PLANS.agency, "membres", 3, 1, 2)).toMatchObject({ allowed: true, limit: 5 });
    expect(checkQuota(PLANS.solo, "membres", 1, 1, 5).allowed).toBe(false); // pas de membre supplémentaire en Solo
    expect(monthlyPrice(PLANS.agency, 2)).toBe(347);
    expect(monthlyPrice(PLANS.essai)).toBeNull();
  });

  it("message clair au quota, avec la remise à zéro pour les quotas mensuels", () => {
    expect(quotaMessage(PLANS.solo, "dossiers", checkQuota(PLANS.solo, "dossiers", 40))).toBe(
      "Quota atteint pour la formule Solo : dossiers de biens ce mois-ci (40 sur 40). Le compteur repart à zéro le 1er du mois.",
    );
    expect(quotaMessage(PLANS.essai, "copilot", checkQuota(PLANS.essai, "copilot", 0))).toBe(
      "Échanges avec le Copilot ce mois-ci : non inclus dans la formule Essai (préproduction).",
    );
  });
});
