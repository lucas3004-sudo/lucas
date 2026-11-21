import { describe, expect, it } from "vitest";
import { dealDeadlines } from "./deadlines";

const base = { stage: "compromis" as const, retraction_notified_on: "2026-11-02", loan_deadline: "2026-12-31", deed_planned_on: "2027-02-15" };

describe("dealDeadlines", () => {
  it("calcule et trie les échéances d'un compromis, avec les jours restants", () => {
    expect(dealDeadlines(base, "2026-11-10")).toEqual([
      { key: "retractation", label: "Fin du délai de rétractation (indicative)", date: "2026-11-12", daysLeft: 2 },
      { key: "pret", label: "Date limite d'obtention du prêt", date: "2026-12-31", daysLeft: 51 },
      { key: "acte", label: "Signature prévue de l'acte", date: "2027-02-15", daysLeft: 97 },
    ]);
  });

  it("une fois les conditions levées, seule la signature de l'acte reste suivie ; rien après l'acte", () => {
    expect(dealDeadlines({ ...base, stage: "conditions_levees" }, "2026-11-10").map((d) => d.key)).toEqual(["acte"]);
    expect(dealDeadlines({ ...base, stage: "acte" }, "2026-11-10")).toEqual([]);
    expect(dealDeadlines({ ...base, stage: "abandon" }, "2026-11-10")).toEqual([]);
  });

  it("une échéance dépassée a un nombre de jours négatif", () => {
    expect(dealDeadlines({ ...base, retraction_notified_on: null, deed_planned_on: null }, "2027-01-05")).toEqual([
      { key: "pret", label: "Date limite d'obtention du prêt", date: "2026-12-31", daysLeft: -5 },
    ]);
  });
});
