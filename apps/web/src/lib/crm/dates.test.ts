import { describe, expect, it } from "vitest";
import { isoDay } from "./dates";

describe("dates PostgreSQL (colonnes « date »)", () => {
  it("relit une date lue par pg (minuit heure locale) sans décalage d'un jour", () => {
    expect(isoDay(new Date(2026, 10, 21))).toBe("2026-11-21");
    expect(isoDay(new Date(2026, 0, 1))).toBe("2026-01-01");
    expect(isoDay(new Date(2026, 2, 29))).toBe("2026-03-29"); // jour du passage à l'heure d'été
  });
  it("laisse passer le texte et les valeurs vides", () => {
    expect(isoDay("2026-11-21")).toBe("2026-11-21");
    expect(isoDay(null)).toBeNull();
    expect(isoDay(undefined)).toBeNull();
  });
});
