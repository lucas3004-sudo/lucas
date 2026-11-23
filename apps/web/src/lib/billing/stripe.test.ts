import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { mapStatus, subscriptionRecord } from "./stripe";

const sub = (over: Partial<Stripe.Subscription> & { lookup?: string }) =>
  ({
    id: "sub_ABC123", status: "active", customer: "cus_XYZ789", metadata: { org_id: "8f8a2c4e-1111-4222-8333-944455556666" },
    items: { data: [{ price: { lookup_key: over.lookup ?? "immopilot_pro_mensuel" }, current_period_end: 1_798_761_600 }] },
    ...over,
  }) as unknown as Stripe.Subscription;

describe("abonnements Stripe → ImmoPilot", () => {
  it("statuts", () => {
    expect(mapStatus("active")).toBe("actif");
    expect(mapStatus("trialing")).toBe("actif");
    expect(mapStatus("past_due")).toBe("en_retard");
    expect(mapStatus("unpaid")).toBe("en_retard");
    expect(mapStatus("canceled")).toBe("annule");
    expect(mapStatus("incomplete")).toBeNull();
  });
  it("formule lue dans la clé du prix, agence dans les métadonnées, fin de période de l'élément", () => {
    expect(subscriptionRecord(sub({}))).toEqual({
      orgId: "8f8a2c4e-1111-4222-8333-944455556666", status: "actif", plan: "pro", customer: "cus_XYZ789", subscription: "sub_ABC123",
      periodEnd: new Date(1_798_761_600 * 1000),
    });
  });
  it("rien d'enregistré sans agence, avec un prix inconnu ou un paiement incomplet", () => {
    expect(subscriptionRecord(sub({ metadata: {} }))).toBeNull();
    expect(subscriptionRecord(sub({ lookup: "autre_produit" }))).toBeNull();
    expect(subscriptionRecord(sub({ status: "incomplete" }))).toBeNull();
  });
});
