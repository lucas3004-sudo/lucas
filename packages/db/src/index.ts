import pg from "pg";

export { withTenant, currentRole, assertTenantContext, TenantContextError } from "./tenant";
export type { TenantContext, TenantDb } from "./tenant";
export * as schema from "./schema/index";

/** Pool de connexions « données des agences » (rôle app_user, soumis à la RLS). */
export function createTenantPool(connectionString: string, max = 10) {
  return new pg.Pool({ connectionString, max });
}
