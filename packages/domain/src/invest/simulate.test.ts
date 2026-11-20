/**
 * Investment Studio : cas vérifiés à la main (critère F7 : au moins 10 cas).
 * Les calculs de chaque cas sont détaillés en commentaire ; les mensualités de prêt ont été
 * recoupées avec un calcul indépendant de la formule d'annuité.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_INPUTS, monthlyPayment, sensitivity, simulate, validateInputs, type InvestmentInputs } from "./simulate";

const cash = (over: Partial<InvestmentInputs>): InvestmentInputs => ({
  ...DEFAULT_INPUTS,
  acquisitionFeesRate: 0,
  vacancyMonths: 0,
  loanInsuranceRate: 0,
  ...over,
  // Achat comptant par défaut : l'apport couvre tout.
  downPayment: over.downPayment ?? 10_000_000,
});

describe("Investment Studio — cas calculés à la main", () => {
  it("1. achat comptant sans frais ni charges : 500 €/mois sur 100 000 € = 6 %", () => {
    const r = simulate(cash({ price: 100_000, monthlyRent: 500 }));
    expect(r.totalCost).toBe(100_000);
    expect(r.grossYield).toBeCloseTo(0.06, 10); // 6 000 / 100 000
    expect(r.netYield).toBeCloseTo(0.06, 10);
    expect(r.loanAmount).toBe(0);
    expect(r.monthlyCashFlow).toBeCloseTo(500, 10);
  });

  it("2. frais d'acquisition de 8 % : coût 108 000 €, brut 6 000 / 108 000 = 5,56 %", () => {
    const r = simulate(cash({ price: 100_000, acquisitionFeesRate: 8, monthlyRent: 500 }));
    expect(r.acquisitionFees).toBe(8_000);
    expect(r.totalCost).toBe(108_000);
    expect(r.grossYield).toBeCloseTo(0.0555556, 6);
  });

  it("3. un mois de vacance : 600 € × 11 = 6 600 € encaissés pour 7 200 € possibles", () => {
    const r = simulate(cash({ price: 100_000, monthlyRent: 600, vacancyMonths: 1 }));
    expect(r.annualRentPotential).toBe(7_200);
    expect(r.annualRentCollected).toBe(6_600);
    expect(r.grossYield).toBeCloseTo(0.072, 10);
    expect(r.netYield).toBeCloseTo(0.066, 10);
  });

  it("4. charges annuelles 1 600 € : net (8 400 − 1 600) / 108 000 = 6,30 %", () => {
    // taxe foncière 800 + copropriété 400 + assurance 150 + entretien 250 = 1 600
    const r = simulate(cash({ price: 100_000, acquisitionFeesRate: 8, monthlyRent: 700, propertyTax: 800, coproCharges: 400, insurance: 150, maintenance: 250 }));
    expect(r.annualCharges).toBe(1_600);
    expect(r.grossYield).toBeCloseTo(0.0777778, 6); // 8 400 / 108 000
    expect(r.netYield).toBeCloseTo(0.0629630, 6); // 6 800 / 108 000
    expect(r.monthlyCashFlow).toBeCloseTo(566.6667, 3); // 6 800 / 12
  });

  it("5. gestion locative de 7 % sur les loyers ENCAISSÉS : 7 % × 11 000 = 770 €", () => {
    const r = simulate(cash({ price: 100_000, monthlyRent: 1_000, vacancyMonths: 1, managementRate: 7 }));
    expect(r.managementFees).toBeCloseTo(770, 10);
    expect(r.netYield).toBeCloseTo(0.1023, 10); // (11 000 − 770) / 100 000
    expect(r.monthlyCashFlow).toBeCloseTo(852.5, 10); // 10 230 / 12
  });

  it("6. prêt de 200 000 € à 3,5 % sur 20 ans : 1 159,92 €/mois, 78 380,66 € d'intérêts", () => {
    expect(monthlyPayment(200_000, 3.5, 20)).toBeCloseTo(1159.92, 2);
    const r = simulate({ ...cash({ price: 200_000 }), downPayment: 0, loanRate: 3.5, loanYears: 20 });
    expect(r.loanAmount).toBe(200_000);
    expect(r.totalInterest).toBeCloseTo(78_380.66, 1);
  });

  it("7. prêt à taux zéro : 100 000 € sur 10 ans = 833,33 €/mois, aucun intérêt", () => {
    expect(monthlyPayment(100_000, 0, 10)).toBeCloseTo(833.33, 2);
    const r = simulate({ ...cash({ price: 100_000 }), downPayment: 0, loanRate: 0, loanYears: 10 });
    expect(r.totalInterest).toBeCloseTo(0, 6);
  });

  it("8. assurance emprunteur 0,30 % sur 200 000 € : 50 €/mois, 12 000 € sur 20 ans", () => {
    const r = simulate({ ...cash({ price: 200_000 }), downPayment: 0, loanRate: 3.5, loanYears: 20, loanInsuranceRate: 0.3 });
    expect(r.monthlyLoanInsurance).toBeCloseTo(50, 10);
    expect(r.totalLoanInsurance).toBeCloseTo(12_000, 6);
  });

  it("9. scénario complet financé à crédit : cash-flow de −168,42 €/mois", () => {
    // Coût : 150 000 + 8 % (12 000) + travaux 10 000 + mobilier 3 000 = 175 000 ; emprunt 175 000 − 25 000 = 150 000.
    // Mensualité 150 000 à 4 % sur 25 ans = 791,76 ; assurance 150 000 × 0,25 % / 12 = 31,25.
    // Loyers encaissés 850 × 11,5 = 9 775 ; charges 900 + 600 + 120 + 300 = 1 920 ; net 7 855.
    // Cash-flow : 7 855 / 12 − 791,76 − 31,25 = −168,42.
    const r = simulate({
      ...DEFAULT_INPUTS,
      price: 150_000, acquisitionFeesRate: 8, works: 10_000, furniture: 3_000,
      monthlyRent: 850, vacancyMonths: 0.5, propertyTax: 900, coproCharges: 600, insurance: 120, maintenance: 300,
      downPayment: 25_000, loanRate: 4, loanYears: 25, loanInsuranceRate: 0.25,
    });
    expect(r.totalCost).toBe(175_000);
    expect(r.loanAmount).toBe(150_000);
    expect(r.monthlyLoanPayment).toBeCloseTo(791.76, 2);
    expect(r.grossYield).toBeCloseTo(0.0582857, 6); // 10 200 / 175 000
    expect(r.netYield).toBeCloseTo(0.0448857, 6); // 7 855 / 175 000
    expect(r.monthlyCashFlow).toBeCloseTo(-168.42, 2);
    expect(r.annualCashFlow).toBeCloseTo(-2021.06, 1);
  });

  it("10. l'apport couvre le coût total : aucun prêt, aucune mensualité ni assurance", () => {
    const r = simulate({ ...DEFAULT_INPUTS, price: 100_000, acquisitionFeesRate: 8, monthlyRent: 500, downPayment: 120_000 });
    expect(r.loanAmount).toBe(0);
    expect(r.monthlyLoanPayment).toBe(0);
    expect(r.monthlyLoanInsurance).toBe(0);
    expect(r.totalInterest).toBe(0);
  });

  it("11. sensibilité : prix −10 % (frais et emprunt suivent) et loyer +10 %", () => {
    const base: InvestmentInputs = {
      ...DEFAULT_INPUTS,
      price: 150_000, acquisitionFeesRate: 8, works: 10_000, furniture: 3_000,
      monthlyRent: 850, vacancyMonths: 0.5, propertyTax: 900, coproCharges: 600, insurance: 120, maintenance: 300,
      downPayment: 25_000, loanRate: 4, loanYears: 25, loanInsuranceRate: 0.25,
    };
    const grid = sensitivity(base);
    expect(grid).toHaveLength(5);
    expect(grid[2]![2]!.monthlyCashFlow).toBeCloseTo(-168.42, 2); // centre = scénario de base
    // Prix 135 000 : coût 158 800, emprunt 133 800 → mensualité 706,25 + assurance 27,875.
    expect(grid[0]![2]!.netYield).toBeCloseTo(0.0494647, 6); // 7 855 / 158 800
    expect(grid[0]![2]!.monthlyCashFlow).toBeCloseTo(-79.54, 2);
    // Loyer 935 : encaissé 10 752,50, net 8 832,50 → 5,05 % ; cash-flow −86,96.
    expect(grid[2]![4]!.netYield).toBeCloseTo(0.0504714, 6);
    expect(grid[2]![4]!.monthlyCashFlow).toBeCloseTo(-86.96, 2);
  });

  it("12. les valeurs hors bornes sont signalées, jamais corrigées en silence", () => {
    expect(validateInputs({ ...DEFAULT_INPUTS, price: 100_000 })).toEqual([]);
    expect(validateInputs({ ...DEFAULT_INPUTS, price: 100_000, vacancyMonths: 13, loanYears: 0, loanRate: Number.NaN })).toEqual([
      "vacancyMonths",
      "loanRate",
      "loanYears",
    ]);
  });
});
