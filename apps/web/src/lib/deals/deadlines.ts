/** Échéances d'une affaire, calculées à partir de ses dates (indicatives : le notaire fait foi). */
import { daysBetween, retractionEnd } from "@immopilot/domain";
import type { DealStage } from "./labels";

export interface DealDates {
  stage: DealStage;
  retraction_notified_on: string | null;
  loan_deadline: string | null;
  deed_planned_on: string | null;
}

export interface Deadline {
  key: "retractation" | "pret" | "acte";
  label: string;
  date: string;
  /** Jours restants (négatif : dépassée). */
  daysLeft: number;
}

export function dealDeadlines(deal: DealDates, today: string): Deadline[] {
  const out: Deadline[] = [];
  const before = (stages: DealStage[]) => stages.includes(deal.stage);
  if (deal.retraction_notified_on && before(["offre", "compromis"])) {
    const end = retractionEnd(deal.retraction_notified_on);
    if (end) out.push({ key: "retractation", label: "Fin du délai de rétractation (indicative)", date: end, daysLeft: daysBetween(today, end)! });
  }
  if (deal.loan_deadline && before(["offre", "compromis"])) {
    out.push({ key: "pret", label: "Date limite d'obtention du prêt", date: deal.loan_deadline, daysLeft: daysBetween(today, deal.loan_deadline)! });
  }
  if (deal.deed_planned_on && before(["offre", "compromis", "conditions_levees"])) {
    out.push({ key: "acte", label: "Signature prévue de l'acte", date: deal.deed_planned_on, daysLeft: daysBetween(today, deal.deed_planned_on)! });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
