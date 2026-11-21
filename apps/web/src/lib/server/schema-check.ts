/**
 * Contrôle de version de la base (D-027, D-046) : le site refuse de servir l'application si une
 * migration connue du code manque en base (code déployé avant sa migration). Le résultat positif
 * est mémorisé pour la durée de vie du processus ; un échec est revérifié à chaque requête.
 */
import { EXPECTED_MIGRATIONS, missingMigrations } from "@immopilot/db";
import { getTenantPool } from "./db";

export interface SchemaStatus {
  ok: boolean;
  expected: number;
  applied: number;
  missing: string[];
}

let upToDate = false;

export async function schemaStatus(): Promise<SchemaStatus> {
  if (upToDate) return { ok: true, expected: EXPECTED_MIGRATIONS.length, applied: EXPECTED_MIGRATIONS.length, missing: [] };
  const { rows } = await getTenantPool().query<{ name: string }>("SELECT name FROM ops.schema_migrations");
  const missing = missingMigrations(rows.map((r) => r.name));
  upToDate = missing.length === 0;
  return { ok: upToDate, expected: EXPECTED_MIGRATIONS.length, applied: rows.length, missing };
}
