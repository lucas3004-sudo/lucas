import { describe, expect, it } from "vitest";
import { daysBetween, easterSunday, frenchPublicHolidays, isWorkingDay, retractionEnd } from "./deadlines";

describe("calendrier français", () => {
  it("dimanche de Pâques (dates de référence)", () => {
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });

  it("les 11 jours fériés de 2026, dont Ascension et lundi de Pentecôte", () => {
    expect(frenchPublicHolidays(2026)).toEqual([
      "2026-01-01", "2026-04-06", "2026-05-01", "2026-05-08", "2026-05-14", "2026-05-25",
      "2026-07-14", "2026-08-15", "2026-11-01", "2026-11-11", "2026-12-25",
    ]);
  });

  it("jours ouvrables : ni samedi, ni dimanche, ni férié", () => {
    expect(isWorkingDay("2026-11-20")).toBe(true); // vendredi
    expect(isWorkingDay("2026-11-21")).toBe(false); // samedi
    expect(isWorkingDay("2026-11-11")).toBe(false); // Armistice (mercredi)
    expect(isWorkingDay("2026-02-30")).toBe(false);
  });
});

describe("délai de rétractation (10 jours, art. L271-1 CCH, prorogé au jour ouvrable)", () => {
  it("cas courant : notification le lundi 2 novembre 2026 → jeudi 12 novembre", () => {
    expect(retractionEnd("2026-11-02")).toBe("2026-11-12");
  });
  it("fin un samedi → lundi suivant", () => {
    expect(retractionEnd("2026-12-02")).toBe("2026-12-14"); // mercredi 2 + 10 = samedi 12 → lundi 14
  });
  it("fin un jour férié → lendemain ouvrable", () => {
    expect(retractionEnd("2026-11-01")).toBe("2026-11-12"); // + 10 = mercredi 11 novembre (férié) → jeudi 12
    expect(retractionEnd("2026-12-15")).toBe("2026-12-28"); // + 10 = vendredi 25 décembre → samedi, dimanche → lundi 28
  });
  it("date illisible : aucun calcul", () => {
    expect(retractionEnd("12/11/2026")).toBeNull();
  });
  it("écart en jours", () => {
    expect(daysBetween("2026-11-21", "2026-12-01")).toBe(10);
    expect(daysBetween("2026-11-21", "2026-11-20")).toBe(-1);
  });
});
