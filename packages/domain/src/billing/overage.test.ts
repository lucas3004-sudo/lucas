import { describe, expect, it } from "vitest";
import { centsLabel, MAX_OVERAGE_CAP_CENTS, OVERAGE_UNIT_CENTS, overageInvoiceLine, parseOverageCap } from "./overage";

describe("crédits IA à l'usage (D-065)", () => {
  it("prix validés par le fondateur : 2 € les 100 échanges, 0,20 € l'annonce", () => {
    expect(OVERAGE_UNIT_CENTS.copilot * 100).toBe(200);
    expect(OVERAGE_UNIT_CENTS.annonces_ia).toBe(20);
  });
  it("plafond saisi en euros, virgule ou point, borné", () => {
    expect(parseOverageCap("30")).toBe(3000);
    expect(parseOverageCap(" 12,5 ")).toBe(1250);
    expect(parseOverageCap("0")).toBe(0);
    expect(parseOverageCap("500")).toBe(MAX_OVERAGE_CAP_CENTS);
    expect(parseOverageCap("500.01")).toBeNull();
    expect(parseOverageCap("-5")).toBeNull();
    expect(parseOverageCap("dix")).toBeNull();
    expect(parseOverageCap("1,234")).toBeNull();
  });
  it("ligne de facture : rien si rien n'a été consommé au-delà du forfait", () => {
    expect(overageInvoiceLine({ copilot: 0, annonces: 0, cents: 0 })).toBeNull();
    expect(overageInvoiceLine({ copilot: 150, annonces: 3, cents: 360 })).toEqual({
      cents: 360, description: "Crédits IA au-delà du forfait : 150 échange(s) avec l'assistant, 3 annonce(s) rédigée(s) par IA",
    });
  });
  it("montants lisibles", () => {
    expect(centsLabel(3000)).toMatch(/^30,00\s€$/);
    expect(centsLabel(2)).toMatch(/^0,02\s€$/);
  });
});
