"use server";
/**
 * Import CSV en deux temps : APERÇU (rien n'est écrit), puis IMPORT confirmé.
 * À la confirmation, tout est recalculé côté serveur (lecture, doublons, géocodage) : on ne fait
 * jamais confiance à l'aperçu renvoyé par le navigateur. Aucun consentement n'est importé.
 */
import { withTenant } from "@immopilot/db";
import {
  decodeCsvBytes,
  findDuplicates,
  normalizeEmail,
  normalizePhone,
  parseContactsCsv,
  parsePropertiesCsv,
  type ContactDraft,
  type ImportRow,
  type PropertyDraft,
} from "@immopilot/domain";
import { geocode, type Address } from "@immopilot/integrations";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAgency, type AgencyContext } from "../agency/context";
import { audit } from "../audit";
import { quotaError } from "../billing/plan";
import { alertMatchingBuyers } from "./alerts";
import { getTenantPool } from "../server/db";
import { duplicateCandidates } from "./data";

const MAX_BYTES = 1_000_000;

export type RowStatus = "ok" | "doublon" | "erreur";
export interface PreviewRow {
  line: number;
  label: string;
  status: RowStatus;
  message: string;
}
export interface ImportState {
  error?: string;
  success?: string;
  preview?: {
    rows: PreviewRow[];
    counts: Record<RowStatus, number>;
    unknownColumns: string[];
    recognized: string[];
    encoding: string;
    /** Quota de contacts dépassé par cet import (formule de l'agence). */
    quotaWarning?: string;
  };
  /** Texte du fichier, renvoyé tel quel pour la confirmation (relu entièrement côté serveur). */
  csv?: string;
  imported?: number;
}

async function readCsv(form: FormData): Promise<{ text: string; encoding: string } | { error: string }> {
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return { error: "Fichier trop volumineux (1 Mo au maximum)." };
    return decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
  }
  const text = form.get("csv");
  if (typeof text === "string" && text.length > 0 && text.length <= MAX_BYTES * 1.2) return { text, encoding: "utf-8" };
  return { error: "Choisissez un fichier CSV." };
}

const counts = (rows: PreviewRow[]) => ({
  ok: rows.filter((r) => r.status === "ok").length,
  doublon: rows.filter((r) => r.status === "doublon").length,
  erreur: rows.filter((r) => r.status === "erreur").length,
});

function canImport(ctx: AgencyContext): string | null {
  return ctx.role === "lecture" ? "Le rôle « lecture seule » ne permet pas d'importer." : null;
}

const targetSchema = (ctx: AgencyContext, form: FormData) => {
  const assign = ctx.role === "gerant" || ctx.role === "manager" || ctx.role === "assistant";
  return z
    .object({ visibility: z.enum(["private", "agency"]), ownerUserId: z.uuid() })
    .safeParse({ visibility: form.get("visibility"), ownerUserId: assign ? form.get("ownerUserId") || ctx.user.id : ctx.user.id });
};

// --- Contacts -----------------------------------------------------------------------------

async function analyzeContacts(ctx: AgencyContext, text: string) {
  const parsed = parseContactsCsv(text);
  if (parsed.fatal) return { fatal: parsed.fatal } as const;
  const existing = await duplicateCandidates(ctx);
  const names = new Map(existing.map((c) => [c.id, c.label]));
  const seen: { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null }[] = [];
  const toInsert: ContactDraft[] = [];
  const rows: PreviewRow[] = parsed.rows.map((row: ImportRow<ContactDraft>) => {
    if (!row.data) return { line: row.line, label: "—", status: "erreur", message: row.errors.join(" ") };
    const d = row.data;
    const label = [d.firstName, d.lastName].filter(Boolean).join(" ");
    const dupExisting = findDuplicates(d, existing);
    if (dupExisting.length) {
      const first = dupExisting[0]!;
      return { line: row.line, label, status: "doublon", message: `Déjà présent : ${names.get(first.id) ?? "contact existant"} (${first.reasons.join(", ")} identique).` };
    }
    const dupFile = findDuplicates(d, seen);
    if (dupFile.length) return { line: row.line, label, status: "doublon", message: `Répété dans le fichier (ligne ${dupFile[0]!.id}).` };
    seen.push({ id: String(row.line), ...d });
    toInsert.push(d);
    return { line: row.line, label, status: "ok", message: d.email ?? d.phone ?? "" };
  });
  return { parsed, rows, toInsert } as const;
}

export async function previewContactsImportAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  const ctx = await requireAgency();
  const denied = canImport(ctx);
  if (denied) return { error: denied };
  const input = await readCsv(form);
  if ("error" in input) return { error: input.error };
  const result = await analyzeContacts(ctx, input.text);
  if ("fatal" in result) return { error: result.fatal };
  const quotaWarning = result.toInsert.length ? await quotaError(ctx, "contacts", result.toInsert.length) : null;
  return {
    csv: input.text,
    preview: {
      rows: result.rows.slice(0, 200),
      counts: counts(result.rows),
      unknownColumns: result.parsed.unknownColumns,
      recognized: Object.values(result.parsed.columns) as string[],
      encoding: input.encoding,
      ...(quotaWarning ? { quotaWarning } : {}),
    },
  };
}

export async function importContactsAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  const ctx = await requireAgency();
  const denied = canImport(ctx);
  if (denied) return { error: denied };
  const target = targetSchema(ctx, form);
  if (!target.success) return { error: "Choisissez la visibilité et le responsable." };
  const input = await readCsv(form);
  if ("error" in input) return { error: input.error };
  const result = await analyzeContacts(ctx, input.text);
  if ("fatal" in result) return { error: result.fatal };
  if (!result.toInsert.length) return { error: "Aucune ligne à importer (toutes sont des doublons ou des erreurs)." };
  const overQuota = await quotaError(ctx, "contacts", result.toInsert.length);
  if (overQuota) return { error: overQuota };
  const { visibility, ownerUserId } = target.data;
  try {
    await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) => {
      for (const d of result.toInsert) {
        await c.query(
          `INSERT INTO app.contacts (org_id, owner_user_id, visibility, roles, first_name, last_name, email, phone, email_norm, phone_norm, source, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [ctx.org.id, ownerUserId, visibility, d.roles, d.firstName, d.lastName, d.email, d.phone,
           normalizeEmail(d.email), normalizePhone(d.phone), d.source ?? "Import CSV", d.notes, ctx.user.id],
        );
      }
    });
  } catch (e) {
    if ((e as { code?: string }).code === "42501") return { error: "Import refusé : vous ne pouvez pas attribuer ces contacts à ce membre." };
    throw e;
  }
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "contacts.importes", details: { lignes: result.toInsert.length } });
  revalidatePath("/app/contacts");
  return { success: `${result.toInsert.length} contact(s) importé(s).`, imported: result.toInsert.length };
}

// --- Biens ----------------------------------------------------------------------------------

/** Exécute fn sur chaque élément, au plus `limit` à la fois (pour ménager la BAN). */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

const MIN_GEOCODE_SCORE = 0.5;

async function analyzeProperties(ctx: AgencyContext, text: string) {
  const parsed = parsePropertiesCsv(text);
  if (parsed.fatal) return { fatal: parsed.fatal } as const;
  const existing = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    new Set((await c.query<{ ban_id: string }>("SELECT ban_id FROM app.properties")).rows.map((r) => r.ban_id)));
  const geocoded = await mapLimit(parsed.rows, 5, async (row) => {
    if (!row.data) return null;
    try {
      const best = (await geocode(row.data.addressQuery, { limit: 1 }))[0];
      return best && best.score >= MIN_GEOCODE_SCORE && (best.type === "housenumber" || best.type === "street") ? best : ("introuvable" as const);
    } catch {
      return "indisponible" as const;
    }
  });
  const seen = new Set<string>();
  const toInsert: Array<{ d: PropertyDraft; a: Address }> = [];
  const rows: PreviewRow[] = parsed.rows.map((row, i) => {
    if (!row.data) return { line: row.line, label: "—", status: "erreur", message: row.errors.join(" ") };
    const a = geocoded[i];
    if (a === "indisponible") return { line: row.line, label: row.data.addressQuery, status: "erreur", message: "Service d'adresses indisponible : réessayez." };
    if (!a || a === "introuvable") return { line: row.line, label: row.data.addressQuery, status: "erreur", message: "Adresse non reconnue par la Base Adresse Nationale." };
    if (existing.has(a.banId)) return { line: row.line, label: a.label, status: "doublon", message: "Un bien existe déjà à cette adresse." };
    if (seen.has(a.banId)) return { line: row.line, label: a.label, status: "doublon", message: "Adresse répétée dans le fichier." };
    seen.add(a.banId);
    toInsert.push({ d: row.data, a });
    return { line: row.line, label: a.label, status: "ok", message: `${row.data.type}${row.data.surface ? `, ${row.data.surface} m²` : ""} · adresse reconnue à ${Math.round(a.score * 100)} %` };
  });
  return { parsed, rows, toInsert } as const;
}

export async function previewPropertiesImportAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  const ctx = await requireAgency();
  const denied = canImport(ctx);
  if (denied) return { error: denied };
  const input = await readCsv(form);
  if ("error" in input) return { error: input.error };
  const result = await analyzeProperties(ctx, input.text);
  if ("fatal" in result) return { error: result.fatal };
  return {
    csv: input.text,
    preview: {
      rows: result.rows,
      counts: counts(result.rows),
      unknownColumns: result.parsed.unknownColumns,
      recognized: Object.values(result.parsed.columns) as string[],
      encoding: input.encoding,
    },
  };
}

export async function importPropertiesAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  const ctx = await requireAgency();
  const denied = canImport(ctx);
  if (denied) return { error: denied };
  const target = targetSchema(ctx, form);
  if (!target.success) return { error: "Choisissez la visibilité et le responsable." };
  const input = await readCsv(form);
  if ("error" in input) return { error: input.error };
  const result = await analyzeProperties(ctx, input.text);
  if ("fatal" in result) return { error: result.fatal };
  if (!result.toInsert.length) return { error: "Aucune ligne à importer (toutes sont des doublons ou des erreurs)." };
  const { visibility, ownerUserId } = target.data;
  let alerts: string[] = [];
  try {
    alerts = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) => {
      const taskIds: string[] = [];
      for (const { d, a } of result.toInsert) {
        const id = (await c.query<{ id: string }>(
          `INSERT INTO app.properties (org_id, owner_user_id, visibility, status, mandate_type, type, address_label, ban_id, insee_code,
             longitude, latitude, surface, rooms, price, dpe_class, features, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id`,
          [ctx.org.id, ownerUserId, visibility, d.status, d.mandateType, d.type, a.label, a.banId, a.inseeCode,
           a.longitude, a.latitude, d.surface, d.rooms, d.price, d.dpeClass, d.features, d.notes, ctx.user.id],
        )).rows[0]!.id;
        taskIds.push(...(await alertMatchingBuyers(c, {
          orgId: ctx.org.id, authorUserId: ctx.user.id, authorName: ctx.user.name, propertyId: id, status: d.status, label: a.label,
          property: { type: d.type, price: d.price, surface: d.surface, rooms: d.rooms, inseeCode: a.inseeCode, features: d.features },
        })));
      }
      return taskIds;
    });
  } catch (e) {
    if ((e as { code?: string }).code === "42501") return { error: "Import refusé : vous ne pouvez pas attribuer ces biens à ce membre." };
    throw e;
  }
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "biens.importes", details: { lignes: result.toInsert.length } });
  for (const taskId of alerts) {
    await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "tache.creee", targetType: "tache", targetId: taskId, details: { motif: "alerte_automatique" } });
  }
  revalidatePath("/app/proprietes");
  const alerted = alerts.length ? ` ${alerts.length} alerte(s) envoyée(s) aux collègues dont un acquéreur correspond.` : "";
  return { success: `${result.toInsert.length} bien(s) importé(s).${alerted}`, imported: result.toInsert.length };
}
