import { describe, expect, it } from "vitest";
import { buildIcs, icsDate, icsEscape, icsFold } from "./ics";
import { parisLocalToUtc, utcToParisLocal } from "./time";

describe("heure de Paris ⇄ UTC", () => {
  it("hiver : UTC+1", () => {
    expect(parisLocalToUtc("2026-11-25T14:30")?.toISOString()).toBe("2026-11-25T13:30:00.000Z");
  });
  it("été : UTC+2", () => {
    expect(parisLocalToUtc("2026-07-14T09:00")?.toISOString()).toBe("2026-07-14T07:00:00.000Z");
  });
  it("passage à l'heure d'été (29 mars 2026) : 2 h 30 n'existe pas, 3 h 30 = 1 h 30 UTC", () => {
    expect(parisLocalToUtc("2026-03-29T02:30")).toBeNull();
    expect(parisLocalToUtc("2026-03-29T03:30")?.toISOString()).toBe("2026-03-29T01:30:00.000Z");
    expect(parisLocalToUtc("2026-03-29T01:30")?.toISOString()).toBe("2026-03-29T00:30:00.000Z");
  });
  it("retour à l'heure d'hiver (25 octobre 2026) : 2 h 30 existe deux fois, on retient la première", () => {
    expect(parisLocalToUtc("2026-10-25T02:30")?.toISOString()).toBe("2026-10-25T00:30:00.000Z");
    expect(parisLocalToUtc("2026-10-25T04:00")?.toISOString()).toBe("2026-10-25T03:00:00.000Z");
  });
  it("aller-retour et saisies invalides", () => {
    expect(utcToParisLocal(new Date("2026-11-25T13:30:00Z"))).toBe("2026-11-25T14:30");
    for (const bad of ["", "2026-13-01T10:00", "2026-11-25 14:30", "2026-02-30T10:00", "abc"]) expect(parisLocalToUtc(bad), bad).toBeNull();
  });
});

describe("export iCalendar (RFC 5545)", () => {
  it("dates en UTC compact", () => {
    expect(icsDate(new Date("2026-11-25T13:30:00.000Z"))).toBe("20261125T133000Z");
  });
  it("échappe les caractères spéciaux", () => {
    expect(icsEscape("Visite; 2 pièces, cave\nCode : 12\\B")).toBe("Visite\\; 2 pièces\\, cave\\nCode : 12\\\\B");
  });
  it("replie à 75 octets sans couper un accent", () => {
    const folded = icsFold(`SUMMARY:${"é".repeat(60)}`);
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"é".repeat(60)}`);
  });
  it("produit un calendrier complet, avec rendez-vous annulé", () => {
    const ics = buildIcs(
      [
        { uid: "a@immopilot", start: new Date("2026-11-25T13:30:00Z"), end: new Date("2026-11-25T14:30:00Z"), summary: "Visite", location: "8 Boulevard du Port, Amiens" },
        { uid: "b@immopilot", start: new Date("2026-11-26T09:00:00Z"), end: new Date("2026-11-26T10:00:00Z"), summary: "Estimation", cancelled: true },
      ],
      { calendarName: "Mes rendez-vous", now: new Date("2026-11-21T08:00:00Z") },
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTAMP:20261121T080000Z");
    expect(ics).toContain("DTSTART:20261125T133000Z\r\nDTEND:20261125T143000Z");
    expect(ics).toContain("LOCATION:8 Boulevard du Port\\, Amiens");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("UID:b@immopilot");
    expect(ics).toMatch(/SUMMARY:Estimation\r\n(?:.*\r\n)*?STATUS:CANCELLED/);
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
  });
});
