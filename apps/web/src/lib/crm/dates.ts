/**
 * Colonne « date » PostgreSQL → « AAAA-MM-JJ ». Le pilote pg la lit comme minuit HEURE LOCALE du
 * serveur : on relit donc les composantes locales (aucun décalage d'un jour, quel que soit le fuseau).
 */
export function isoDay(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.slice(0, 10);
  const d = v as Date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
