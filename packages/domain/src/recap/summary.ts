/**
 * Récap de l'activité (D-062) : transforme les chiffres d'une période (24 heures ou 7 jours)
 * en lignes courtes et claires, des bonnes nouvelles aux points d'attention. Sans IA : chaque
 * ligne vient d'un comptage réel. L'IA pourra plus tard en faire un texte rédigé.
 */

export type RecapPeriod = "jour" | "semaine";

export interface RecapCounts {
  newProperties: number;
  priceDrops: number;
  underOffer: number;
  sold: number;
  newContacts: number;
  newBuyerProfiles: number;
  visitsDone: number;
  strongInterest: number;
  upcomingVisits: number;
  newDeals: number;
  deeds: number;
  tasksDone: number;
  tasksOverdue: number;
  approvalsPending: number;
  mandatesEndingSoon: number;
}

export type RecapTone = "success" | "brand" | "warning" | "neutral";

export interface RecapLine {
  key: keyof RecapCounts;
  tone: RecapTone;
  text: string;
  href: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export const RECAP_PERIOD_LABELS: Record<RecapPeriod, string> = { jour: "Dernières 24 heures", semaine: "7 derniers jours" };

export function recapLines(c: RecapCounts): RecapLine[] {
  const lines: RecapLine[] = [];
  const add = (key: keyof RecapCounts, tone: RecapTone, text: string, href: string) => {
    if (c[key] > 0) lines.push({ key, tone, text, href });
  };
  // Résultats d'abord, puis l'activité, puis ce qui demande une action.
  add("deeds", "success", plural(c.deeds, "vente signée chez le notaire", "ventes signées chez le notaire"), "/app/affaires");
  add("sold", "success", plural(c.sold, "bien vendu", "biens vendus"), "/app/proprietes");
  add("newDeals", "success", plural(c.newDeals, "nouvelle offre ouverte", "nouvelles offres ouvertes"), "/app/affaires");
  add("underOffer", "success", plural(c.underOffer, "bien passé sous offre", "biens passés sous offre"), "/app/proprietes");
  add("strongInterest", "success", plural(c.strongInterest, "visite avec un intérêt fort", "visites avec un intérêt fort"), "/app/agenda");
  add("newProperties", "brand", plural(c.newProperties, "nouveau bien", "nouveaux biens"), "/app/proprietes");
  add("priceDrops", "brand", plural(c.priceDrops, "baisse de prix", "baisses de prix"), "/app/proprietes");
  add("newContacts", "brand", plural(c.newContacts, "nouveau contact", "nouveaux contacts"), "/app/contacts");
  add("newBuyerProfiles", "brand", plural(c.newBuyerProfiles, "nouvelle recherche d'acquéreur", "nouvelles recherches d'acquéreurs"), "/app/contacts");
  add("visitsDone", "brand", plural(c.visitsDone, "visite effectuée", "visites effectuées"), "/app/agenda");
  add("tasksDone", "brand", plural(c.tasksDone, "tâche terminée", "tâches terminées"), "/app/taches");
  add("upcomingVisits", "neutral", `${plural(c.upcomingVisits, "visite prévue", "visites prévues")} dans les 7 prochains jours`, "/app/agenda");
  add("tasksOverdue", "warning", plural(c.tasksOverdue, "tâche en retard", "tâches en retard"), "/app/taches");
  add("approvalsPending", "warning", `${plural(c.approvalsPending, "proposition d'agent attend", "propositions d'agents attendent")} votre accord`, "/app/agents/approbations");
  add("mandatesEndingSoon", "warning", `${plural(c.mandatesEndingSoon, "mandat se termine", "mandats se terminent")} dans les 30 jours`, "/app/proprietes");
  return lines;
}

/** Phrase d'accroche : les deux ou trois faits les plus marquants, ou « rien de nouveau ». */
export function recapHeadline(c: RecapCounts, period: RecapPeriod): string {
  const facts = recapLines(c).filter((l) => l.tone !== "warning" && l.key !== "upcomingVisits").slice(0, 3).map((l) => l.text);
  const when = period === "jour" ? "Depuis hier" : "Cette semaine";
  if (facts.length === 0) return `${when} : rien de nouveau dans l'agence.`;
  const list = facts.length === 1 ? facts[0] : `${facts.slice(0, -1).join(", ")} et ${facts[facts.length - 1]}`;
  return `${when} : ${list}.`;
}
