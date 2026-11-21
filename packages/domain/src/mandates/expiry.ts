/**
 * Échéance des mandats (F5). Le logiciel prévient avant la date de fin saisie par l'agence ; il ne
 * calcule AUCUN délai légal (irrévocabilité, préavis) : ces règles dépendent du contrat signé.
 */
import { daysBetween } from "../deals/deadlines";

/** Prévenir à partir de 30 jours avant la fin. */
export const MANDATE_WARNING_DAYS = 30;

export type MandateAlert = { kind: "expire"; daysAgo: number } | { kind: "bientot"; daysLeft: number };

/** Statuts pour lesquels le mandat est en cours (le bien n'est ni vendu, ni retiré, ni simple prospect). */
const ACTIVE = new Set(["mandat", "sous_offre"]);

export function mandateAlert(property: { status: string; mandateEndsOn: string | null }, today: string): MandateAlert | null {
  if (!ACTIVE.has(property.status) || !property.mandateEndsOn) return null;
  const left = daysBetween(today, property.mandateEndsOn);
  if (left === null) return null;
  if (left < 0) return { kind: "expire", daysAgo: -left };
  if (left <= MANDATE_WARNING_DAYS) return { kind: "bientot", daysLeft: left };
  return null;
}

export function mandateAlertLabel(alert: MandateAlert): string {
  if (alert.kind === "expire") return alert.daysAgo === 0 ? "Mandat expiré aujourd'hui" : `Mandat expiré depuis ${alert.daysAgo} jour(s)`;
  if (alert.daysLeft === 0) return "Mandat : dernier jour";
  return `Mandat : fin dans ${alert.daysLeft} jour(s)`;
}
