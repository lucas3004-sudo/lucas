import { describe, expect, it } from "vitest";
import { accessFor } from "./access";

const created = new Date("2026-11-01T10:00:00Z");
const at = (iso: string) => new Date(iso);

describe("accès selon l'essai et l'abonnement (D-057)", () => {
  it("14 jours d'essai gratuit à partir de la création de l'agence", () => {
    expect(accessFor(created, null, at("2026-11-02T10:00:00Z"))).toMatchObject({ allowed: true, reason: "essai", daysLeft: 13 });
    expect(accessFor(created, null, at("2026-11-15T09:59:00Z"))).toMatchObject({ allowed: true, reason: "essai", daysLeft: 1 });
    expect(accessFor(created, null, at("2026-11-15T10:00:00Z"))).toEqual({ allowed: false, reason: "essai_termine" });
  });
  it("abonnement actif : accès, même après l'essai", () => {
    expect(accessFor(created, { status: "actif", currentPeriodEnd: at("2026-12-20T00:00:00Z"), pastDueSince: null }, at("2026-12-01T00:00:00Z"))).toEqual({ allowed: true, reason: "abonnement" });
  });
  it("paiement en échec : 7 jours de grâce, puis blocage", () => {
    const sub = { status: "en_retard" as const, currentPeriodEnd: null, pastDueSince: at("2026-12-01T00:00:00Z") };
    expect(accessFor(created, sub, at("2026-12-03T00:00:00Z"))).toMatchObject({ allowed: true, reason: "paiement_en_retard", daysLeft: 5 });
    expect(accessFor(created, sub, at("2026-12-08T00:00:01Z"))).toEqual({ allowed: false, reason: "paiement_echoue" });
  });
  it("abonnement résilié : l'essai restant compte encore, puis blocage", () => {
    const sub = { status: "annule" as const, currentPeriodEnd: at("2026-11-05T00:00:00Z"), pastDueSince: null };
    expect(accessFor(created, sub, at("2026-11-10T00:00:00Z"))).toMatchObject({ allowed: true, reason: "essai" });
    expect(accessFor(created, sub, at("2026-12-01T00:00:00Z"))).toEqual({ allowed: false, reason: "abonnement_termine" });
  });
});
