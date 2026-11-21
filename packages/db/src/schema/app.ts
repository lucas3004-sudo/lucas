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
  feeScheduleUrl: text("fee_schedule_url"),
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

/** Dossiers de biens : instantanés immuables (aucun droit UPDATE en base). */
export const analyses = app.table("analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  kind: text("kind", { enum: ["dossier"] }).notNull().default("dossier"),
  addressLabel: text("address_label").notNull(),
  banId: text("ban_id").notNull(),
  inseeCode: text("insee_code").notNull(),
  inputs: jsonb("inputs").$type<Record<string, unknown>>().notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
});
