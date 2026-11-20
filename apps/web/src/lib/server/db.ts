/** Pool « données des agences » (rôle app_user, soumis à la RLS). Une instance par processus. */
import { createTenantPool } from "@immopilot/db";
import type pg from "pg";
import { requireEnv } from "./env";

const globalForDb = globalThis as unknown as { immopilotTenantPool?: pg.Pool };

export function getTenantPool(): pg.Pool {
  globalForDb.immopilotTenantPool ??= createTenantPool(requireEnv("DATABASE_URL"));
  return globalForDb.immopilotTenantPool;
}
