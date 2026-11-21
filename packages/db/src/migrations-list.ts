/**
 * Migrations attendues par CE code (ordre d'application). Le site vérifie au démarrage qu'elles
 * sont toutes appliquées en base (D-027, D-046) ; un garde-fou de test vérifie que cette liste
 * correspond exactement aux fichiers de packages/db/migrations.
 */
export const EXPECTED_MIGRATIONS = [
  "0001_schemas.sql",
  "0002_auth.sql",
  "0003_tenancy.sql",
  "0004_auth_rate_limit.sql",
  "0005_reference_data.sql",
  "0006_analyses.sql",
  "0007_crm.sql",
  "0008_crm_profile_owner_fix.sql",
  "0009_appointments.sql",
  "0010_deals.sql",
  "0011_listing_fields.sql",
  "0012_property_photos.sql",
  "0013_two_factor.sql",
  "0014_agents.sql",
  "0015_schema_version_check.sql",
] as const;

/** Migrations attendues mais absentes de la base, dans l'ordre. */
export function missingMigrations(applied: readonly string[]): string[] {
  const done = new Set(applied);
  return EXPECTED_MIGRATIONS.filter((m) => !done.has(m));
}
