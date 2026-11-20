/**
 * Investment Studio : lecture des hypothèses depuis l'adresse de la page (formulaire GET).
 * Aucune donnée personnelle : la simulation se partage par son lien.
 */
import { DEFAULT_INPUTS, INPUT_BOUNDS, validateInputs, type InvestmentInputs } from "@immopilot/domain";

export type InputKey = keyof InvestmentInputs;

export const INPUT_LABELS: Record<InputKey, { label: string; unit: string; hint?: string }> = {
  price: { label: "Prix d'achat", unit: "€", hint: "Net vendeur." },
  acquisitionFeesRate: { label: "Frais d'acquisition", unit: "% du prix", hint: "« Frais de notaire » : environ 7 à 8 % dans l'ancien, 2 à 3 % dans le neuf. Le notaire fixe le montant exact." },
  agencyFees: { label: "Honoraires d'agence à la charge de l'acquéreur", unit: "€" },
  works: { label: "Travaux", unit: "€" },
  furniture: { label: "Mobilier", unit: "€" },
  monthlyRent: { label: "Loyer mensuel hors charges", unit: "€ / mois" },
  vacancyMonths: { label: "Vacance locative", unit: "mois / an", hint: "Mois sans locataire ni loyer, en moyenne." },
  propertyTax: { label: "Taxe foncière", unit: "€ / an" },
  coproCharges: { label: "Charges de copropriété non récupérables", unit: "€ / an" },
  insurance: { label: "Assurance propriétaire non occupant", unit: "€ / an" },
  maintenance: { label: "Entretien (provision)", unit: "€ / an" },
  managementRate: { label: "Gestion locative", unit: "% des loyers", hint: "0 si vous gérez vous-même." },
  downPayment: { label: "Apport", unit: "€" },
  loanRate: { label: "Taux du prêt", unit: "% par an", hint: "Taux nominal, hors assurance." },
  loanYears: { label: "Durée du prêt", unit: "ans" },
  loanInsuranceRate: { label: "Assurance emprunteur", unit: "% par an", hint: "Sur le capital emprunté." },
};

export const INPUT_GROUPS: Array<{ title: string; keys: InputKey[] }> = [
  { title: "Achat", keys: ["price", "acquisitionFeesRate", "agencyFees", "works", "furniture"] },
  { title: "Location", keys: ["monthlyRent", "vacancyMonths", "managementRate"] },
  { title: "Charges annuelles", keys: ["propertyTax", "coproCharges", "insurance", "maintenance"] },
  { title: "Financement", keys: ["downPayment", "loanRate", "loanYears", "loanInsuranceRate"] },
];

type Params = Partial<Record<string, string | string[] | undefined>>;

function num(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const cleaned = raw.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

export interface ParsedSimulation {
  inputs: InvestmentInputs;
  /** Hypothèses hors bornes ou illisibles (clés). */
  errors: InputKey[];
  /** Vrai dès qu'un prix a été saisi : sinon, on affiche seulement le formulaire. */
  submitted: boolean;
  /** Repère de loyer ANIL transmis par un dossier de bien (charges comprises). */
  rentReference: { low: number; high: number } | null;
  /** Libellé du bien d'origine (adresse), s'il y en a un. */
  subject: string | null;
}

export function parseSimulation(params: Params): ParsedSimulation {
  const inputs = { ...DEFAULT_INPUTS };
  const unreadable = new Set<InputKey>();
  for (const key of Object.keys(INPUT_BOUNDS) as InputKey[]) {
    const v = num(params[key]);
    if (v === null) continue;
    if (Number.isNaN(v)) unreadable.add(key);
    else inputs[key] = v;
  }
  const submitted = num(params.price) !== null;
  const errors = submitted ? [...new Set([...unreadable, ...(validateInputs(inputs) as InputKey[])])] : [];
  const low = num(params.repere_bas);
  const high = num(params.repere_haut);
  const subject = typeof params.bien === "string" && params.bien.trim() ? params.bien.trim().slice(0, 200) : null;
  return {
    inputs,
    errors,
    submitted,
    rentReference: low && high && low > 0 && high >= low && high < 100_000 ? { low, high } : null,
    subject,
  };
}
