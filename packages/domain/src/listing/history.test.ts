import { describe, expect, it } from "vitest";
import { listingHistory, type PropertyEvent } from "./history";

const d = (s: string) => new Date(`${s}T10:00:00Z`);
const ev = (kind: PropertyEvent["kind"], at: string, oldValue: string | null, newValue: string | null): PropertyEvent => ({ kind, at: d(at), oldValue, newValue });

describe("historique d'un bien", () => {
  it("bien saisi en prospect puis mis en vente : la date de mise en vente est celle du passage en mandat", () => {
    const h = listingHistory(
      [ev("cree", "2026-09-01", null, "250000"), ev("statut", "2026-09-10", "prospect", "mandat")],
      "mandat",
      250000,
      d("2026-11-23"),
    );
    expect(h.listedOn).toEqual(d("2026-09-10"));
    expect(h.daysOnMarket).toBe(74);
  });

  it("bien saisi directement en vente : mis en vente à sa création", () => {
    const h = listingHistory([ev("cree", "2026-11-01", null, "180000")], "mandat", 180000, d("2026-11-23"));
    expect(h.listedOn).toEqual(d("2026-11-01"));
    expect(h.daysOnMarket).toBe(22);
  });

  it("prospect jamais mis en vente : pas de durée en vente", () => {
    const h = listingHistory([ev("cree", "2026-11-01", null, null)], "prospect", null, d("2026-11-23"));
    expect(h.listedOn).toBeNull();
    expect(h.daysOnMarket).toBeNull();
  });

  it("la durée s'arrête à la vente", () => {
    const h = listingHistory(
      [ev("cree", "2026-06-01", null, "300000"), ev("statut", "2026-06-02", "prospect", "mandat"), ev("statut", "2026-08-01", "sous_offre", "vendu")],
      "vendu",
      300000,
      d("2026-11-23"),
    );
    expect(h.daysOnMarket).toBe(60);
  });

  it("baisses de prix : chaque changement et la variation totale", () => {
    const h = listingHistory(
      [ev("cree", "2026-09-01", null, "250000"), ev("prix", "2026-10-01", "250000", "239000"), ev("prix", "2026-11-01", "239000", "229000")],
      "mandat",
      229000,
      d("2026-11-23"),
    );
    expect(h.priceChanges.map((c) => c.change)).toEqual([-0.044, -0.0418]);
    expect(h.firstPrice).toBe(250000);
    expect(h.totalChange).toBe(-0.084);
  });

  it("prix inconnu à la création : le premier prix connu vient du premier changement", () => {
    const h = listingHistory([ev("cree", "2026-09-01", null, null), ev("prix", "2026-10-01", null, "200000")], "mandat", 200000, d("2026-11-23"));
    expect(h.priceChanges).toEqual([]);
    expect(h.firstPrice).toBeNull();
    expect(h.totalChange).toBeNull();
  });
});
