/**
 * Heures « murales » de Paris ⇄ instants UTC, sans bibliothèque : l'écart (UTC+1 l'hiver,
 * UTC+2 l'été) est lu dans la base de fuseaux du moteur JavaScript (Intl).
 */
export const AGENCY_TIME_ZONE = "Europe/Paris";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: AGENCY_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Écart (ms) entre l'heure de Paris et UTC à un instant donné. */
function offsetAt(utcMs: number): number {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * « 2026-11-25T14:30 » (heure de Paris, champ datetime-local) → instant UTC.
 * Renvoie null si la saisie est illisible ou tombe dans l'heure sautée au passage à l'heure d'été.
 */
export function parisLocalToUtc(local: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // Deux candidats : avec l'écart en vigueur 12 h avant et 12 h après. On garde ceux qui
  // s'affichent bien à l'heure saisie : aucun = heure sautée (passage à l'heure d'été) ;
  // deux = heure répétée (retour à l'heure d'hiver), on retient la première.
  const HALF_DAY = 12 * 3600 * 1000;
  const candidates = [...new Set([wall - offsetAt(wall - HALF_DAY), wall - offsetAt(wall + HALF_DAY)])]
    .filter((utc) => utcToParisLocal(new Date(utc)) === local)
    .sort((a, b) => a - b);
  return candidates.length ? new Date(candidates[0]!) : null;
}

/** Instant → « 2026-11-25T14:30 » en heure de Paris (pour pré-remplir un champ datetime-local). */
export function utcToParisLocal(date: Date): string {
  const p = Object.fromEntries(partsFmt.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Premier jour du mois (heure de Paris) contenant `now`, décalé de `offsetMonths` mois, à minuit. */
export function parisMonthStart(now: Date, offsetMonths = 0): Date {
  const [y, m] = utcToParisLocal(now).slice(0, 7).split("-").map(Number) as [number, number];
  const index = y * 12 + (m - 1) + offsetMonths;
  const month = String((index % 12) + 1).padStart(2, "0");
  // Minuit le 1er n'est jamais une heure sautée à Paris (changements d'heure à 2 h et 3 h).
  return parisLocalToUtc(`${Math.floor(index / 12)}-${month}-01T00:00`)!;
}
