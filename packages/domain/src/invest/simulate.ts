/**
 * Investment Studio (critère F7) : simulation d'un investissement locatif.
 *
 * - Toutes les hypothèses sont des ENTRÉES modifiables, affichées avec le résultat.
 * - Rendements calculés sur le COÛT TOTAL d'acquisition (prix + frais + travaux + mobilier),
 *   définition plus prudente que « loyer / prix ».
 * - Résultats AVANT IMPÔT : la fiscalité dépend de la situation de chacun (aucun conseil fiscal).
 * - Mensualité : prêt amortissable à mensualités constantes, assurance calculée sur le capital
 *   initial (cas le plus courant ; la banque fixe les conditions réelles).
 */

export interface InvestmentInputs {
  /** Prix d'achat, net vendeur (€). */
  price: number;
  /** Frais d'acquisition (« frais de notaire »), en % du prix. Hypothèse : le notaire fixe le montant exact. */
  acquisitionFeesRate: number;
  /** Honoraires d'agence à la charge de l'acquéreur (€). */
  agencyFees: number;
  works: number;
  furniture: number;
  /** Loyer mensuel hors charges (€). */
  monthlyRent: number;
  /** Mois sans locataire par an (0 à 12). */
  vacancyMonths: number;
  /** Taxe foncière (€ par an). */
  propertyTax: number;
  /** Charges de copropriété non récupérables sur le locataire (€ par an). */
  coproCharges: number;
  /** Assurance propriétaire non occupant (€ par an). */
  insurance: number;
  /** Provision pour entretien (€ par an). */
  maintenance: number;
  /** Gestion locative, en % des loyers encaissés. */
  managementRate: number;
  /** Apport personnel (€). */
  downPayment: number;
  /** Taux nominal annuel du prêt (%). */
  loanRate: number;
  /** Durée du prêt (années). */
  loanYears: number;
  /** Assurance emprunteur, en % annuel du capital emprunté. */
  loanInsuranceRate: number;
}

export interface InvestmentResult {
  acquisitionFees: number;
  totalCost: number;
  loanAmount: number;
  monthlyLoanPayment: number;
  monthlyLoanInsurance: number;
  totalInterest: number;
  totalLoanInsurance: number;
  annualRentPotential: number;
  annualRentCollected: number;
  managementFees: number;
  annualCharges: number;
  /** Loyers annuels (sans vacance) / coût total. */
  grossYield: number;
  /** (Loyers encaissés − charges) / coût total, avant impôt et hors crédit. */
  netYield: number;
  /** Chaque mois, avant impôt : (loyers encaissés − charges) / 12 − mensualité − assurance emprunteur. */
  monthlyCashFlow: number;
  annualCashFlow: number;
}

export const DEFAULT_INPUTS: InvestmentInputs = {
  price: 0,
  acquisitionFeesRate: 8,
  agencyFees: 0,
  works: 0,
  furniture: 0,
  monthlyRent: 0,
  vacancyMonths: 0.5,
  propertyTax: 0,
  coproCharges: 0,
  insurance: 0,
  maintenance: 0,
  managementRate: 0,
  downPayment: 0,
  loanRate: 3.5,
  loanYears: 20,
  loanInsuranceRate: 0.3,
};

/** Mensualité d'un prêt amortissable à mensualités constantes (hors assurance). */
export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0) return 0;
  const n = Math.round(years * 12);
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - (1 + r) ** -n);
}

/** Bornes de saisie : une valeur hors bornes est signalée, jamais corrigée en silence. */
export const INPUT_BOUNDS: Record<keyof InvestmentInputs, { min: number; max: number }> = {
  price: { min: 1000, max: 100_000_000 },
  acquisitionFeesRate: { min: 0, max: 20 },
  agencyFees: { min: 0, max: 10_000_000 },
  works: { min: 0, max: 50_000_000 },
  furniture: { min: 0, max: 10_000_000 },
  monthlyRent: { min: 0, max: 1_000_000 },
  vacancyMonths: { min: 0, max: 12 },
  propertyTax: { min: 0, max: 1_000_000 },
  coproCharges: { min: 0, max: 1_000_000 },
  insurance: { min: 0, max: 100_000 },
  maintenance: { min: 0, max: 1_000_000 },
  managementRate: { min: 0, max: 50 },
  downPayment: { min: 0, max: 100_000_000 },
  loanRate: { min: 0, max: 20 },
  loanYears: { min: 1, max: 30 },
  loanInsuranceRate: { min: 0, max: 5 },
};

export function validateInputs(inputs: InvestmentInputs): string[] {
  const errors: string[] = [];
  for (const [key, { min, max }] of Object.entries(INPUT_BOUNDS) as [keyof InvestmentInputs, { min: number; max: number }][]) {
    const v = inputs[key];
    if (!Number.isFinite(v) || v < min || v > max) errors.push(key);
  }
  return errors;
}

export function simulate(inputs: InvestmentInputs): InvestmentResult {
  const i = inputs;
  const acquisitionFees = (i.price * i.acquisitionFeesRate) / 100;
  const totalCost = i.price + acquisitionFees + i.agencyFees + i.works + i.furniture;
  const loanAmount = Math.max(0, totalCost - i.downPayment);
  const monthlyLoanPayment = monthlyPayment(loanAmount, i.loanRate, i.loanYears);
  const months = Math.round(i.loanYears * 12);
  const monthlyLoanInsurance = loanAmount > 0 ? (loanAmount * i.loanInsuranceRate) / 100 / 12 : 0;

  const annualRentPotential = i.monthlyRent * 12;
  const annualRentCollected = i.monthlyRent * (12 - i.vacancyMonths);
  const managementFees = (annualRentCollected * i.managementRate) / 100;
  const annualCharges = i.propertyTax + i.coproCharges + i.insurance + i.maintenance + managementFees;
  const netOperating = annualRentCollected - annualCharges;

  const monthlyCashFlow = netOperating / 12 - monthlyLoanPayment - monthlyLoanInsurance;
  return {
    acquisitionFees,
    totalCost,
    loanAmount,
    monthlyLoanPayment,
    monthlyLoanInsurance,
    totalInterest: loanAmount > 0 ? monthlyLoanPayment * months - loanAmount : 0,
    totalLoanInsurance: monthlyLoanInsurance * months,
    annualRentPotential,
    annualRentCollected,
    managementFees,
    annualCharges,
    grossYield: totalCost > 0 ? annualRentPotential / totalCost : 0,
    netYield: totalCost > 0 ? netOperating / totalCost : 0,
    monthlyCashFlow,
    annualCashFlow: monthlyCashFlow * 12,
  };
}

export const SENSITIVITY_STEPS = [-10, -5, 0, 5, 10] as const;

export interface SensitivityCell {
  priceChange: number;
  rentChange: number;
  netYield: number;
  monthlyCashFlow: number;
}

/**
 * Sensibilité au prix et au loyer : chaque ligne fait varier le prix (les frais d'acquisition et
 * le montant emprunté suivent, l'apport reste fixe), chaque colonne fait varier le loyer.
 */
export function sensitivity(inputs: InvestmentInputs, steps: readonly number[] = SENSITIVITY_STEPS): SensitivityCell[][] {
  return steps.map((priceChange) =>
    steps.map((rentChange) => {
      const r = simulate({
        ...inputs,
        price: inputs.price * (1 + priceChange / 100),
        monthlyRent: inputs.monthlyRent * (1 + rentChange / 100),
      });
      return { priceChange, rentChange, netYield: r.netYield, monthlyCashFlow: r.monthlyCashFlow };
    }),
  );
}
