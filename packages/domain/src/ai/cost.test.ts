import { describe, expect, it } from "vitest";
import { aiCostMicroUsd, aiDecision, aiGate } from "./cost";

describe("coût d'un appel à l'IA", () => {
  it("Haiku 5.5 : 0,10 $ / 0,50 $ par million de jetons", () => {
    // 10 000 jetons en entrée et 500 en sortie : 0,001 $ + 0,00025 $ = 1 250 micro-dollars.
    expect(aiCostMicroUsd("claude-haiku-5-5", 10_000, 500)).toBe(1250);
  });

  it("Haiku 5.5 au-delà de 100 000 jetons en entrée : tarif long", () => {
    expect(aiCostMicroUsd("claude-haiku-5-5", 200_000, 1000)).toBe(100_000 + 2500);
  });

  it("modèle inconnu : tarif le plus cher, par prudence ; arrondi au supérieur", () => {
    expect(aiCostMicroUsd("modele-inconnu", 1, 1)).toBe(24);
    expect(aiCostMicroUsd("claude-haiku-5-5", 1, 0)).toBe(1);
  });
});

describe("garde-fous de l'IA", () => {
  const ok = { enabled: true, role: "negociateur", limit: 200, used: 10, budgetLeft: true };
  it("autorisé dans le quota et sous le plafond", () => expect(aiGate(ok)).toBeNull());
  it("désactivée sans clé", () => expect(aiGate({ ...ok, enabled: false })).toBe("desactivee"));
  it("lecture seule refusée", () => expect(aiGate({ ...ok, role: "lecture" })).toBe("lecture_seule"));
  it("formule sans IA", () => expect(aiGate({ ...ok, limit: 0, used: 0 })).toBe("non_inclus"));
  it("quota atteint", () => expect(aiGate({ ...ok, used: 200 })).toBe("quota_atteint"));
  it("illimité", () => expect(aiGate({ ...ok, limit: null, used: 10_000 })).toBeNull());
  it("plafond global atteint, même avec du quota", () => expect(aiGate({ ...ok, budgetLeft: false })).toBe("budget_atteint"));
});

describe("crédits IA à l'usage (D-065)", () => {
  const base = { enabled: true, role: "negociateur", limit: 200, used: 200, budgetLeft: true };
  const overage = { billable: true, capCents: 3000, spentCents: 0, unitCents: 2 };
  it("quota épuisé, agence abonnée, plafond non atteint : l'appel passe et sera facturé", () => {
    expect(aiDecision({ ...base, overage })).toEqual({ reason: null, overage: true });
  });
  it("dans le quota : jamais facturé à l'usage", () => {
    expect(aiDecision({ ...base, used: 10, overage })).toEqual({ reason: null, overage: false });
  });
  it("sans abonnement payant ou plafond à 0 (désactivé) : quota atteint", () => {
    expect(aiGate({ ...base, overage: { ...overage, billable: false } })).toBe("quota_atteint");
    expect(aiGate({ ...base, overage: { ...overage, capCents: 0 } })).toBe("quota_atteint");
    expect(aiGate(base)).toBe("quota_atteint");
  });
  it("le plafond du gérant est respecté au centime près", () => {
    expect(aiGate({ ...base, overage: { ...overage, spentCents: 2998 } })).toBeNull();
    expect(aiGate({ ...base, overage: { ...overage, spentCents: 2999 } })).toBe("plafond_atteint");
  });
  it("formule sans IA : jamais de dépassement ; plafond global de la plateforme toujours appliqué", () => {
    expect(aiGate({ ...base, limit: 0, used: 0, overage })).toBe("non_inclus");
    expect(aiGate({ ...base, overage, budgetLeft: false })).toBe("budget_atteint");
  });
});
