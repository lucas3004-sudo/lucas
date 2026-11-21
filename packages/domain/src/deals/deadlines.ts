/**
 * Échéances d'une vente (critère F12, version légère). Calculs INDICATIFS : le notaire fait foi.
 *
 * - Délai de rétractation de l'acquéreur non professionnel : 10 jours à compter du lendemain
 *   de la première présentation de la lettre (ou de la remise en main propre) — art. L271-1 du
 *   Code de la construction et de l'habitation. Un délai qui expire un samedi, un dimanche ou un
 *   jour férié est prorogé au premier jour ouvrable suivant (art. 642 du Code de procédure civile).
 * - Jours fériés nationaux uniquement (l'Alsace-Moselle en compte deux de plus : non gérés).
 */

const DAY = 86_400_000;

/** Date ISO « AAAA-MM-JJ » → instant UTC à midi (évite tout effet de fuseau). */
function parse(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return d.toISOString().slice(0, 10) === iso ? d : null;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher, calendrier grégorien). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Les 11 jours fériés nationaux de l'année. */
export function frenchPublicHolidays(year: number): string[] {
  const easter = parse(easterSunday(year))!;
  return [
    `${year}-01-01`,
    iso(addDays(easter, 1)), // lundi de Pâques
    `${year}-05-01`,
    `${year}-05-08`,
    iso(addDays(easter, 39)), // Ascension
    iso(addDays(easter, 50)), // lundi de Pentecôte
    `${year}-07-14`,
    `${year}-08-15`,
    `${year}-11-01`,
    `${year}-11-11`,
    `${year}-12-25`,
  ].sort();
}

export function isWorkingDay(date: string): boolean {
  const d = parse(date);
  if (!d) return false;
  const weekday = d.getUTCDay();
  return weekday !== 0 && weekday !== 6 && !frenchPublicHolidays(d.getUTCFullYear()).includes(date);
}

/**
 * Dernier jour du délai de rétractation, à partir de la date de première présentation de la
 * notification (ou de remise en main propre). Null si la date est illisible.
 */
export function retractionEnd(notifiedOn: string): string | null {
  const start = parse(notifiedOn);
  if (!start) return null;
  let end = addDays(start, 10);
  while (!isWorkingDay(iso(end))) end = addDays(end, 1);
  return iso(end);
}

/** Nombre de jours entre deux dates ISO (positif si `to` est après `from`). */
export function daysBetween(from: string, to: string): number | null {
  const a = parse(from);
  const b = parse(to);
  return a && b ? Math.round((b.getTime() - a.getTime()) / DAY) : null;
}
