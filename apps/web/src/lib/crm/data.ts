/**
 * Lectures du CRM. Toutes passent par withTenant() : la base applique elle-même l'isolation
 * par agence et la visibilité privé / agence (migration 0007).
 */
import { withTenant } from "@immopilot/db";
import type { MatchProfile, MatchProperty, PropertyFeature } from "@immopilot/domain";
import { headers } from "next/headers";
import { cache } from "react";
import type { AgencyContext } from "../agency/context";
import { getAuth } from "../auth/server";
import { getTenantPool } from "../server/db";
import type { ConsentChannel, ContactRole, ProfileStatus, PropertyStatus } from "./labels";

export interface Contact {
  id: string;
  owner_user_id: string;
  visibility: "private" | "agency";
  roles: ContactRole[];
  first_name: string | null;
  last_name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Consent {
  id: string;
  channel: ConsentChannel;
  status: "accorde" | "retire";
  obtained_at: string;
  expires_at: string | null;
  proof: string;
  recorded_by: string;
  recorded_at: Date;
}

export interface BuyerProfile {
  id: string;
  contact_id: string;
  owner_user_id: string;
  status: ProfileStatus;
  types: Array<"Appartement" | "Maison">;
  budget_max: number | null;
  surface_min: number | null;
  rooms_min: number | null;
  insee_codes: string[];
  features: PropertyFeature[];
  created_at: Date;
  /** Null si le contact n'est pas visible par l'utilisateur (acquéreur privé d'un collègue). */
  contact_name: string | null;
}

export interface Property {
  id: string;
  owner_user_id: string;
  visibility: "private" | "agency";
  status: PropertyStatus;
  mandate_type: "simple" | "exclusif" | null;
  type: "Appartement" | "Maison";
  address_label: string;
  ban_id: string;
  insee_code: string;
  surface: number | null;
  rooms: number | null;
  price: number | null;
  dpe_class: string | null;
  features: PropertyFeature[];
  seller_contact_id: string | null;
  notes: string | null;
  created_at: Date;
}

export interface Task {
  id: string;
  assignee_user_id: string;
  created_by: string;
  title: string;
  details: string | null;
  due_on: string | null;
  status: "a_faire" | "faite";
  contact_id: string | null;
  property_id: string | null;
  created_at: Date;
}

const tenant = (ctx: AgencyContext) => ({ orgId: ctx.org.id, userId: ctx.user.id });
const NUM = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Membres de l'agence (pour les noms et l'attribution). */
export const agencyMembers = cache(async (orgId: string) => {
  const full = await getAuth().api.getFullOrganization({ headers: await headers(), query: { organizationId: orgId } });
  return (full?.members ?? []).map((m) => ({ userId: m.userId, name: m.user.name, role: m.role }));
});

export function contactName(c: { first_name: string | null; last_name: string }): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}

export async function listContacts(ctx: AgencyContext, q?: string): Promise<Contact[]> {
  const search = q?.trim() ? `%${q.trim().replace(/[%_]/g, "")}%` : null;
  return withTenant(getTenantPool(), tenant(ctx), async (_db, c) =>
    (await c.query<Contact>(
      `SELECT * FROM app.contacts
       WHERE ($1::text IS NULL OR last_name ILIKE $1 OR first_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)
       ORDER BY last_name, first_name LIMIT 300`,
      [search],
    )).rows,
  );
}

/** Tous les contacts visibles, réduits aux champs utiles à la détection des doublons (sans limite). */
export async function duplicateCandidates(ctx: AgencyContext) {
  return withTenant(getTenantPool(), tenant(ctx), async (_db, c) =>
    (await c.query<{ id: string; first_name: string | null; last_name: string; email: string | null; phone: string | null }>(
      "SELECT id, first_name, last_name, email, phone FROM app.contacts",
    )).rows.map((r) => ({ id: r.id, firstName: r.first_name, lastName: r.last_name, email: r.email, phone: r.phone, label: contactName(r) })),
  );
}

export async function getContact(ctx: AgencyContext, id: string) {
  return withTenant(getTenantPool(), tenant(ctx), async (_db, c) => {
    const contact = (await c.query<Contact>("SELECT * FROM app.contacts WHERE id = $1", [id])).rows[0];
    if (!contact) return null;
    const consents = (await c.query<Consent>(
      `SELECT id, channel, status, obtained_at::text, expires_at::text, proof, recorded_by, recorded_at
       FROM app.contact_consents WHERE contact_id = $1 ORDER BY recorded_at DESC`,
      [id],
    )).rows;
    const profiles = (await c.query(`SELECT * FROM app.buyer_profiles WHERE contact_id = $1 ORDER BY created_at DESC`, [id])).rows.map(toProfile);
    return { contact, consents, profiles };
  });
}

function toProfile(r: Record<string, unknown>): BuyerProfile {
  return {
    ...(r as unknown as BuyerProfile),
    budget_max: NUM(r.budget_max),
    surface_min: NUM(r.surface_min),
    rooms_min: NUM(r.rooms_min),
    contact_name: (r.contact_name as string | null | undefined) ?? null,
  };
}

function toProperty(r: Record<string, unknown>): Property {
  return { ...(r as unknown as Property), surface: NUM(r.surface), rooms: NUM(r.rooms), price: NUM(r.price) };
}

/** État courant du consentement par canal : la dernière ligne enregistrée fait foi. */
export function currentConsents(consents: Consent[], today = new Date().toISOString().slice(0, 10)) {
  const result: Partial<Record<ConsentChannel, { valid: boolean; consent: Consent }>> = {};
  for (const consent of consents) {
    if (result[consent.channel]) continue;
    const valid = consent.status === "accorde" && (!consent.expires_at || consent.expires_at >= today);
    result[consent.channel] = { valid, consent };
  }
  return result;
}

export async function listProperties(ctx: AgencyContext): Promise<Property[]> {
  return withTenant(getTenantPool(), tenant(ctx), async (_db, c) =>
    (await c.query("SELECT * FROM app.properties ORDER BY created_at DESC LIMIT 300")).rows.map(toProperty),
  );
}

export async function getProperty(ctx: AgencyContext, id: string): Promise<Property | null> {
  return withTenant(getTenantPool(), tenant(ctx), async (_db, c) => {
    const row = (await c.query("SELECT * FROM app.properties WHERE id = $1", [id])).rows[0];
    return row ? toProperty(row) : null;
  });
}

/** Profils actifs de TOUTE l'agence (critères), avec le nom seulement si le contact est visible. */
export async function activeProfiles(ctx: AgencyContext): Promise<BuyerProfile[]> {
  return withTenant(getTenantPool(), tenant(ctx), async (_db, c) =>
    (await c.query(
      `SELECT p.*, NULLIF(concat_ws(' ', ct.first_name, ct.last_name), '') AS contact_name
       FROM app.buyer_profiles p LEFT JOIN app.contacts ct ON ct.id = p.contact_id
       WHERE p.status = 'actif' ORDER BY p.created_at DESC`,
    )).rows.map(toProfile),
  );
}

export async function matchableProperties(ctx: AgencyContext): Promise<Property[]> {
  return withTenant(getTenantPool(), tenant(ctx), async (_db, c) =>
    (await c.query(`SELECT * FROM app.properties WHERE status IN ('prospect', 'mandat', 'sous_offre')`)).rows.map(toProperty),
  );
}

/** Tâches : « mine » = qui me sont confiées ; « team » = toutes celles que je peux voir (RLS). */
export async function listTasks(
  ctx: AgencyContext,
  scope: "mine" | "team",
  filter: { contactId?: string; propertyId?: string } = {},
): Promise<Task[]> {
  return withTenant(getTenantPool(), tenant(ctx), async (_db, c) =>
    (await c.query<Task>(
      `SELECT id, assignee_user_id, created_by, title, details, due_on::text, status, contact_id, property_id, created_at
       FROM app.tasks
       WHERE ($1 = 'team' OR assignee_user_id = $2)
         AND ($3::uuid IS NULL OR contact_id = $3) AND ($4::uuid IS NULL OR property_id = $4)
       ORDER BY status, due_on NULLS LAST, created_at DESC LIMIT 300`,
      [scope, ctx.user.id, filter.contactId ?? null, filter.propertyId ?? null],
    )).rows,
  );
}

export async function communeNames(ctx: AgencyContext, inseeCodes: string[]): Promise<Map<string, string>> {
  if (!inseeCodes.length) return new Map();
  const { rows } = await getTenantPool().query<{ insee_code: string; commune: string }>(
    "SELECT insee_code, commune FROM ref.zonage_abc WHERE insee_code = ANY($1)", [inseeCodes],
  );
  return new Map(rows.map((r) => [r.insee_code, r.commune]));
}

export const asMatchProperty = (p: Property): MatchProperty => ({
  type: p.type, price: p.price, surface: p.surface, rooms: p.rooms, inseeCode: p.insee_code, features: p.features,
});

export const asMatchProfile = (p: BuyerProfile): MatchProfile => ({
  types: p.types, budgetMax: p.budget_max, surfaceMin: p.surface_min, roomsMin: p.rooms_min, inseeCodes: p.insee_codes, features: p.features,
});
