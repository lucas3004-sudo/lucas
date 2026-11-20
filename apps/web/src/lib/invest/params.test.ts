import { DEFAULT_INPUTS } from "@immopilot/domain";
import { describe, expect, it } from "vitest";
import { parseSimulation } from "./params";

describe("parseSimulation", () => {
  it("sans prix : formulaire seul, hypothèses par défaut, aucune erreur", () => {
    const r = parseSimulation({});
    expect(r.submitted).toBe(false);
    expect(r.inputs).toEqual(DEFAULT_INPUTS);
    expect(r.errors).toEqual([]);
  });

  it("lit les nombres à la française (virgule, espaces) et garde les valeurs par défaut", () => {
    const r = parseSimulation({ price: "150 000", monthlyRent: "850,50", loanRate: "3,9" });
    expect(r.submitted).toBe(true);
    expect(r.inputs.price).toBe(150_000);
    expect(r.inputs.monthlyRent).toBe(850.5);
    expect(r.inputs.loanRate).toBe(3.9);
    expect(r.inputs.loanYears).toBe(DEFAULT_INPUTS.loanYears);
    expect(r.errors).toEqual([]);
  });

  it("signale les valeurs illisibles ou hors bornes au lieu de les corriger", () => {
    const r = parseSimulation({ price: "150000", vacancyMonths: "abc", loanYears: "45" });
    expect(r.errors.sort()).toEqual(["loanYears", "vacancyMonths"]);
  });

  it("repère de loyer et bien d'origine : acceptés seulement s'ils sont cohérents", () => {
    expect(parseSimulation({ repere_bas: "700", repere_haut: "900", bien: "8 Boulevard du Port" })).toMatchObject({
      rentReference: { low: 700, high: 900 },
      subject: "8 Boulevard du Port",
    });
    expect(parseSimulation({ repere_bas: "900", repere_haut: "700" }).rentReference).toBeNull();
  });
});
