/** « Ma journée » : sélection des éléments du jour, en heure de Paris. Fonctions pures. */
import { parisLocalToUtc } from "@immopilot/domain";
import type { Task } from "../crm/data";

/** Date ISO du jour suivant (calendrier, sans fuseau). */
export function nextDay(iso: string, days = 1): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Bornes UTC de « aujourd'hui et demain » à Paris : [aujourd'hui 0 h, après-demain 0 h[. */
export function todayAndTomorrowWindow(today: string): { from: Date; to: Date } {
  return { from: parisLocalToUtc(`${today}T00:00`)!, to: parisLocalToUtc(`${nextDay(today, 2)}T00:00`)! };
}

export interface TaskBuckets {
  overdue: Task[];
  today: Task[];
  /** Signalements « Bien correspondant » encore ouverts (alertes ou « Prévenir »). */
  matches: Task[];
}

export function bucketTasks(tasks: readonly Task[], today: string): TaskBuckets {
  const open = tasks.filter((t) => t.status === "a_faire");
  return {
    overdue: open.filter((t) => t.due_on !== null && t.due_on < today),
    today: open.filter((t) => t.due_on === today),
    matches: open.filter((t) => t.title.startsWith("Bien correspondant")),
  };
}
