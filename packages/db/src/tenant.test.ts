import { describe, expect, it } from "vitest";
import { assertTenantContext, TenantContextError } from "./tenant";

describe("assertTenantContext", () => {
  const ok = { orgId: "aaaaaaaa-0000-4000-8000-000000000000", userId: "bbbbbbbb-0000-4000-8000-000000000000" };

  it("accepte des identifiants UUID", () => {
    expect(() => assertTenantContext(ok)).not.toThrow();
  });

  it.each([
    ["agence vide", { ...ok, orgId: "" }],
    ["utilisateur vide", { ...ok, userId: "" }],
    ["injection", { ...ok, orgId: "x'; DROP TABLE app.audit_log; --" }],
  ])("refuse un contexte invalide (%s)", (_label, ctx) => {
    expect(() => assertTenantContext(ctx)).toThrow(TenantContextError);
  });
});
