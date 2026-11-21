import { describe, expect, it } from "vitest";
import { mandateAlert, mandateAlertLabel } from "./expiry";

describe("échéance des mandats", () => {
  const today = "2026-11-21";
  it("prévient dans les 30 jours, et après la fin", () => {
    expect(mandateAlert({ status: "mandat", mandateEndsOn: "2026-12-01" }, today)).toEqual({ kind: "bientot", daysLeft: 10 });
    expect(mandateAlert({ status: "sous_offre", mandateEndsOn: "2026-12-21" }, today)).toEqual({ kind: "bientot", daysLeft: 30 });
    expect(mandateAlert({ status: "mandat", mandateEndsOn: "2026-12-22" }, today)).toBeNull();
    expect(mandateAlert({ status: "mandat", mandateEndsOn: "2026-11-18" }, today)).toEqual({ kind: "expire", daysAgo: 3 });
  });
  it("ignore les biens sans mandat en cours ou sans date de fin", () => {
    for (const status of ["prospect", "vendu", "retire"]) expect(mandateAlert({ status, mandateEndsOn: "2026-11-25" }, today)).toBeNull();
    expect(mandateAlert({ status: "mandat", mandateEndsOn: null }, today)).toBeNull();
  });
  it("passage à l'heure d'hiver sans décalage d'un jour", () => {
    expect(mandateAlert({ status: "mandat", mandateEndsOn: "2026-10-26" }, "2026-10-24")).toEqual({ kind: "bientot", daysLeft: 2 });
  });
  it("libellés", () => {
    expect(mandateAlertLabel({ kind: "bientot", daysLeft: 10 })).toBe("Mandat : fin dans 10 jour(s)");
    expect(mandateAlertLabel({ kind: "bientot", daysLeft: 0 })).toBe("Mandat : dernier jour");
    expect(mandateAlertLabel({ kind: "expire", daysAgo: 3 })).toBe("Mandat expiré depuis 3 jour(s)");
  });
});
