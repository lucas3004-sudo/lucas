/**
 * Export calendrier au format iCalendar (RFC 5545), lisible par Google Agenda, Outlook et
 * Apple Calendrier. Fonction pure : échappement du texte, lignes repliées à 75 octets,
 * heures en UTC, fins de ligne CRLF.
 */
export interface IcsEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location?: string | null;
  description?: string | null;
  cancelled?: boolean;
  /** Date de dernière modification (sert aux agendas pour mettre à jour l'événement). */
  updatedAt?: Date;
}

export function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Échappement RFC 5545 (3.3.11) : barre oblique inverse, point-virgule, virgule, sauts de ligne. */
export function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Repli des lignes à 75 octets UTF-8 (3.1), sans couper un caractère accentué. */
export function icsFold(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // les lignes de continuation commencent par une espace
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildIcs(events: readonly IcsEvent[], options: { calendarName?: string; now?: Date } = {}): string {
  const stamp = icsDate(options.now ?? new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ImmoPilot AI//Agenda//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  if (options.calendarName) lines.push(`X-WR-CALNAME:${icsEscape(options.calendarName)}`);
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(e.start)}`,
      `DTEND:${icsDate(e.end)}`,
      `SUMMARY:${icsEscape(e.summary)}`,
    );
    if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    if (e.updatedAt) lines.push(`LAST-MODIFIED:${icsDate(e.updatedAt)}`);
    lines.push(`STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(icsFold).join("\r\n") + "\r\n";
}
