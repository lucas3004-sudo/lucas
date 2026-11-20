/**
 * Seule porte d'accès aux données d'une agence (décision D-016).
 *
 * withTenant ouvre une transaction, fixe le contexte (agence, utilisateur) en mode
 * TRANSACTION, exécute la fonction, puis valide. Le contexte disparaît avec la transaction :
 * une connexion réutilisée ne garde rien (test d'intégration « contexte limité »).
 *
 * La base vérifie elle-même que l'utilisateur est membre de l'agence (app.ctx_role()) :
 * un contexte erroné ne donne accès à rien.
 */
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

export interface TenantContext {
  orgId: string;
  userId: string;
}

export type TenantDb = NodePgDatabase<typeof schema>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TenantContextError extends Error {}

export function assertTenantContext(ctx: TenantContext): void {
  if (!UUID.test(ctx.orgId) || !UUID.test(ctx.userId)) {
    throw new TenantContextError("Contexte d'agence invalide.");
  }
}

export async function withTenant<T>(
  pool: pg.Pool,
  ctx: TenantContext,
  fn: (db: TenantDb, client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  assertTenantContext(ctx);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // true = valable pour la transaction uniquement. Le mode session est interdit (D-016).
    await client.query("SELECT set_config('app.org_id', $1, true), set_config('app.user_id', $2, true)", [
      ctx.orgId,
      ctx.userId,
    ]);
    const result = await fn(drizzle(client, { schema }), client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Rôle de l'utilisateur dans l'agence du contexte, tel que la base le calcule (NULL = non membre). */
export async function currentRole(client: pg.PoolClient): Promise<string | null> {
  const { rows } = await client.query<{ role: string | null }>("SELECT app.ctx_role() AS role");
  return rows[0]?.role ?? null;
}
