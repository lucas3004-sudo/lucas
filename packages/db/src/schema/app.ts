/**
 * Tables du schéma « app » (données des agences, sous RLS).
 * Source de vérité : les migrations SQL (packages/db/migrations). Ce fichier en donne la forme
 * typée pour les requêtes ; un test d'intégration vérifie que les deux concordent.
 */
import { jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const app = pgSchema("app");

export const organizationSettings = app.table("organization_settings", {
  orgId: uuid("org_id").primaryKey(),
  defaultVisibility: text("default_visibility", { enum: ["private", "agency"] }).notNull().default("agency"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").notNull(),
});

export const auditLog = app.table("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  actorUserId: uuid("actor_user_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});
