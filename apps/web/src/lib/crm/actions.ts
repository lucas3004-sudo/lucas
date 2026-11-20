"use server";
/**
 * Actions du CRM. La base applique l'isolation et la visibilité (RLS) ; ces actions valident
 * les entrées, donnent des messages clairs et journalisent SANS donnée personnelle
 * (identifiants uniquement : un effacement RGPD ne laisse pas de nom dans le journal).
 */
import { withTenant } from "@immopilot/db";
import { FEATURE_KEYS, findDuplicates, normalizeEmail, normalizePhone } from "@immopilot/domain";
import { communesByPostcode, geocode } from "@immopilot/integrations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "../agency/actions";
import { requireAgency, type AgencyContext } from "../agency/context";
import { audit } from "../audit";
import { getTenantPool } from "../server/db";
import { contactName, listContacts } from "./data";

export type CrmState = ActionState & { duplicates?: Array<{ id: string; label: string; reasons: string[] }> };

const tenant = (ctx: AgencyContext) => ({ orgId: ctx.org.id, userId: ctx.user.id });
const UUID = z.uuid("Identifiant invalide.");
const optionalText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable());
const optionalNumber = (schema: z.ZodNumber) => z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().pipe(schema).nullable());
const isDenied = (e: unknown) => (e as { code?: string })?.code === "42501";

function canAssign(ctx: AgencyContext): boolean {
  return ctx.role === "gerant" || ctx.role === "manager" || ctx.role === "assistant";
}

// --- Contacts -----------------------------------------------------------------------------

const contactSchema = z.object({
  firstName: optionalText(80),
  lastName: z.string().trim().min(1, "Le nom est obligatoire.").max(120),
  email: optionalText(200).refine((v) => v === null || normalizeEmail(v) !== null, "Adresse e-mail invalide."),
  phone: optionalText(40).refine((v) => v === null || normalizePhone(v) !== null, "Numéro de téléphone invalide."),
  roles: z.array(z.enum(["acquereur", "vendeur", "investisseur", "bailleur", "locataire", "autre"])).max(6),
  visibility: z.enum(["private", "agency"]),
  ownerUserId: UUID,
  source: optionalText(120),
  notes: optionalText(5000),
});

function parseContact(form: FormData, ctx: AgencyContext) {
  return contactSchema.safeParse({
    firstName: form.get("firstName"), lastName: form.get("lastName"), email: form.get("email"), phone: form.get("phone"),
    roles: form.getAll("roles"), visibility: form.get("visibility"),
    ownerUserId: canAssign(ctx) ? form.get("ownerUserId") || ctx.user.id : ctx.user.id,
    source: form.get("source"), notes: form.get("notes"),
  });
}

export async function createContactAction(_prev: CrmState, form: FormData): Promise<CrmState> {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") return { error: "Le rôle « lecture seule » ne permet pas de créer un contact." };
  const parsed = parseContact(form, ctx);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  const d = parsed.data;

  // Doublons parmi les contacts visibles (signalés, jamais fusionnés automatiquement).
  if (form.get("confirmDuplicate") !== "1") {
    const visible = await listContacts(ctx);
    const dups = findDuplicates(
      { firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone },
      visible.map((c) => ({ id: c.id, firstName: c.first_name, lastName: c.last_name, email: c.email, phone: c.phone })),
    );
    if (dups.length) {
      const names = new Map(visible.map((c) => [c.id, contactName(c)]));
      return {
        error: "Ce contact ressemble à un contact existant. Vérifiez avant de créer un doublon.",
        duplicates: dups.map((x) => ({ id: x.id, label: names.get(x.id) ?? "", reasons: x.reasons })),
      };
    }
  }

  let id: string;
  try {
    id = await withTenant(getTenantPool(), tenant(ctx), async (_db, c) =>
      (await c.query<{ id: string }>(
        `INSERT INTO app.contacts (org_id, owner_user_id, visibility, roles, first_name, last_name, email, phone,
           email_norm, phone_norm, source, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
        [ctx.org.id, d.ownerUserId, d.visibility, d.roles, d.firstName, d.lastName, d.email, d.phone,
         normalizeEmail(d.email), normalizePhone(d.phone), d.source, d.notes, ctx.user.id],
      )).rows[0]!.id);
  } catch (e) {
    if (isDenied(e)) return { error: "Vous ne pouvez pas créer ce contact (responsable hors de vos droits)." };
    throw e;
  }
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "contact.cree", targetType: "contact", targetId: id });
  redirect(`/app/contacts/${id}`);
}

export async function updateContactAction(_prev: CrmState, form: FormData): Promise<CrmState> {
  const ctx = await requireAgency();
  const id = UUID.safeParse(form.get("id"));
  if (!id.success) return { error: "Contact introuvable." };
  const parsed = parseContact(form, ctx);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  const d = parsed.data;
  let updated = 0;
  try {
    updated = await withTenant(getTenantPool(), tenant(ctx), async (_db, c) => {
      const n = (await c.query(
        `UPDATE app.contacts SET first_name = $2, last_name = $3, email = $4, phone = $5, email_norm = $6, phone_norm = $7,
           roles = $8, visibility = $9, owner_user_id = CASE WHEN $10::boolean THEN $11::uuid ELSE owner_user_id END,
           source = $12, notes = $13, updated_at = now()
         WHERE id = $1`,
        [id.data, d.firstName, d.lastName, d.email, d.phone, normalizeEmail(d.email), normalizePhone(d.phone),
         d.roles, d.visibility, canAssign(ctx), d.ownerUserId, d.source, d.notes],
      )).rowCount ?? 0;
      // Les profils de recherche suivent le responsable du contact (même transaction).
      if (n && canAssign(ctx)) {
        await c.query("UPDATE app.buyer_profiles SET owner_user_id = $2, updated_at = now() WHERE contact_id = $1 AND owner_user_id <> $2", [id.data, d.ownerUserId]);
      }
      return n;
    });
  } catch (e) {
    if (isDenied(e)) return { error: "Modification refusée." };
    throw e;
  }
  if (!updated) return { error: "Vous ne pouvez modifier que vos propres contacts." };
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "contact.modifie", targetType: "contact", targetId: id.data });
  revalidatePath(`/app/contacts/${id.data}`);
  return { success: "Contact enregistré." };
}

export async function deleteContactAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  const id = UUID.parse(form.get("id"));
  const deleted = await withTenant(getTenantPool(), tenant(ctx), async (_db, c) =>
    (await c.query("DELETE FROM app.contacts WHERE id = $1", [id])).rowCount ?? 0);
  if (deleted) await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "contact.supprime", targetType: "contact", targetId: id });
  redirect("/app/contacts");
}

// --- Consentements ------------------------------------------------------------------------

const consentSchema = z.object({
  contactId: UUID,
  channel: z.enum(["telephone", "email", "sms"]),
  status: z.enum(["accorde", "retire"]),
  obtainedAt: z.iso.date("Date invalide."),
  expiresAt: z.preprocess((v) => (v === "" ? null : v), z.iso.date().nullable()),
  proof: z.string().trim().min(3, "Décrivez la preuve du consentement (où, quand, comment).").max(1000),
});

export async function addConsentAction(_prev: CrmState, form: FormData): Promise<CrmState> {
  const ctx = await requireAgency();
  const parsed = consentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  const d = parsed.data;
  if (d.expiresAt && d.expiresAt < d.obtainedAt) return { error: "La date d'expiration précède la date d'obtention." };
  try {
    await withTenant(getTenantPool(), tenant(ctx), (_db, c) =>
      c.query(
        `INSERT INTO app.contact_consents (org_id, contact_id, channel, status, obtained_at, expires_at, proof, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [ctx.org.id, d.contactId, d.channel, d.status, d.obtainedAt, d.expiresAt, d.proof, ctx.user.id],
      ));
  } catch (e) {
    if (isDenied(e)) return { error: "Seul le responsable du contact (ou le gérant, un manager, un assistant) peut enregistrer un consentement." };
    throw e;
  }
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "consentement.enregistre", targetType: "contact", targetId: d.contactId, details: { canal: d.channel, statut: d.status } });
  revalidatePath(`/app/contacts/${d.contactId}`);
  return { success: d.status === "accorde" ? "Consentement enregistré." : "Retrait du consentement enregistré." };
}

// --- Profils de recherche -----------------------------------------------------------------

const profileSchema = z.object({
  contactId: UUID,
  types: z.array(z.enum(["Appartement", "Maison"])).min(1, "Choisissez au moins un type de bien."),
  budgetMax: optionalNumber(z.number().int().min(1000, "Budget invalide.").max(100_000_000)),
  surfaceMin: optionalNumber(z.number().min(9).max(2000)),
  roomsMin: optionalNumber(z.number().int().min(1).max(30)),
  postcodes: z.string().trim().max(200),
  features: z.array(z.enum(FEATURE_KEYS as [string, ...string[]])).max(FEATURE_KEYS.length),
});

export async function createProfileAction(_prev: CrmState, form: FormData): Promise<CrmState> {
  const ctx = await requireAgency();
  const parsed = profileSchema.safeParse({
    contactId: form.get("contactId"), types: form.getAll("types"), budgetMax: form.get("budgetMax"),
    surfaceMin: form.get("surfaceMin"), roomsMin: form.get("roomsMin"), postcodes: form.get("postcodes") ?? "",
    features: form.getAll("features"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  const d = parsed.data;

  const postcodes = [...new Set(d.postcodes.split(/[\s,;]+/).filter(Boolean))];
  const invalid = postcodes.filter((p) => !/^\d{5}$/.test(p));
  if (invalid.length) return { error: `Code(s) postal(aux) invalide(s) : ${invalid.join(", ")}.` };
  let inseeCodes: string[] = [];
  try {
    inseeCodes = [...new Set((await Promise.all(postcodes.map((p) => communesByPostcode(p)))).flat().map((c) => c.inseeCode))];
  } catch {
    return { error: "Le service des communes ne répond pas. Réessayez dans un instant." };
  }
  if (postcodes.length && !inseeCodes.length) return { error: "Aucune commune trouvée pour ces codes postaux." };

  try {
    await withTenant(getTenantPool(), tenant(ctx), async (_db, c) => {
      const owner = (await c.query<{ owner_user_id: string }>("SELECT owner_user_id FROM app.contacts WHERE id = $1", [d.contactId])).rows[0];
      if (!owner) throw Object.assign(new Error("contact"), { code: "42501" });
      await c.query(
        `INSERT INTO app.buyer_profiles (org_id, contact_id, owner_user_id, types, budget_max, surface_min, rooms_min, insee_codes, features, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [ctx.org.id, d.contactId, owner.owner_user_id, d.types, d.budgetMax, d.surfaceMin, d.roomsMin, inseeCodes, d.features, ctx.user.id],
      );
    });
  } catch (e) {
    if (isDenied(e)) return { error: "Seul le responsable du contact (ou le gérant, un manager, un assistant) peut créer son profil de recherche." };
    throw e;
  }
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "profil.cree", targetType: "contact", targetId: d.contactId });
  revalidatePath(`/app/contacts/${d.contactId}`);
  return { success: "Profil de recherche enregistré." };
}

export async function setProfileStatusAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  const id = UUID.parse(form.get("id"));
  const contactId = UUID.parse(form.get("contactId"));
  const status = z.enum(["actif", "en_pause", "clos"]).parse(form.get("status"));
  await withTenant(getTenantPool(), tenant(ctx), (_db, c) =>
    c.query("UPDATE app.buyer_profiles SET status = $2, updated_at = now() WHERE id = $1", [id, status]));
  revalidatePath(`/app/contacts/${contactId}`);
}

// --- Biens de l'agence --------------------------------------------------------------------

const propertySchema = z.object({
  label: z.string().trim().min(3, "Choisissez une adresse dans la liste.").max(200),
  banId: z.string().trim().min(5, "Choisissez une adresse dans la liste.").max(64),
  type: z.enum(["Appartement", "Maison"]),
  surface: optionalNumber(z.number().min(9).max(2000)),
  rooms: optionalNumber(z.number().int().min(1).max(30)),
  price: optionalNumber(z.number().int().min(1000).max(100_000_000)),
  dpeClass: z.preprocess((v) => (v === "" ? null : v), z.enum(["A", "B", "C", "D", "E", "F", "G"]).nullable()),
  features: z.array(z.enum(FEATURE_KEYS as [string, ...string[]])),
  status: z.enum(["prospect", "mandat", "sous_offre", "vendu", "retire"]),
  mandateType: z.preprocess((v) => (v === "" ? null : v), z.enum(["simple", "exclusif"]).nullable()),
  visibility: z.enum(["private", "agency"]),
  ownerUserId: UUID,
  notes: optionalText(5000),
});

export async function createPropertyAction(_prev: CrmState, form: FormData): Promise<CrmState> {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") return { error: "Le rôle « lecture seule » ne permet pas de créer un bien." };
  const parsed = propertySchema.safeParse({
    label: form.get("label"), banId: form.get("banId"), type: form.get("type"), surface: form.get("surface"),
    rooms: form.get("rooms"), price: form.get("price"), dpeClass: form.get("dpeClass") ?? "", features: form.getAll("features"),
    status: form.get("status"), mandateType: form.get("mandateType") ?? "", visibility: form.get("visibility"),
    ownerUserId: canAssign(ctx) ? form.get("ownerUserId") || ctx.user.id : ctx.user.id, notes: form.get("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  const d = parsed.data;
  let address;
  try {
    address = (await geocode(d.label, { limit: 5 })).find((a) => a.banId === d.banId);
  } catch {
    return { error: "Le service d'adresses (BAN) ne répond pas. Réessayez dans un instant." };
  }
  if (!address) return { error: "Adresse non reconnue. Choisissez-la dans la liste proposée." };

  let id: string;
  try {
    id = await withTenant(getTenantPool(), tenant(ctx), async (_db, c) =>
      (await c.query<{ id: string }>(
        `INSERT INTO app.properties (org_id, owner_user_id, visibility, status, mandate_type, type, address_label, ban_id, insee_code,
           longitude, latitude, surface, rooms, price, dpe_class, features, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id`,
        [ctx.org.id, d.ownerUserId, d.visibility, d.status, d.mandateType, d.type, address.label, address.banId, address.inseeCode,
         address.longitude, address.latitude, d.surface, d.rooms, d.price, d.dpeClass, d.features, d.notes, ctx.user.id],
      )).rows[0]!.id);
  } catch (e) {
    if (isDenied(e)) return { error: "Vous ne pouvez pas créer ce bien (responsable hors de vos droits)." };
    throw e;
  }
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "bien_agence.cree", targetType: "bien", targetId: id });
  redirect(`/app/proprietes/${id}`);
}

export async function setPropertyStatusAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  const id = UUID.parse(form.get("id"));
  const status = z.enum(["prospect", "mandat", "sous_offre", "vendu", "retire"]).parse(form.get("status"));
  await withTenant(getTenantPool(), tenant(ctx), (_db, c) =>
    c.query("UPDATE app.properties SET status = $2, updated_at = now() WHERE id = $1", [id, status]));
  revalidatePath(`/app/proprietes/${id}`);
}

export async function deletePropertyAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  const id = UUID.parse(form.get("id"));
  const deleted = await withTenant(getTenantPool(), tenant(ctx), async (_db, c) =>
    (await c.query("DELETE FROM app.properties WHERE id = $1", [id])).rowCount ?? 0);
  if (deleted) await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "bien_agence.supprime", targetType: "bien", targetId: id });
  redirect("/app/proprietes");
}

// --- Tâches -------------------------------------------------------------------------------

/** « Prévenir le collègue » : crée une tâche pour le responsable d'un acquéreur privé, sans révéler son identité. */
export async function notifyColleagueAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  const profileId = UUID.parse(form.get("profileId"));
  const propertyId = UUID.parse(form.get("propertyId"));
  const score = z.coerce.number().int().min(0).max(100).parse(form.get("score"));
  await withTenant(getTenantPool(), tenant(ctx), async (_db, c) => {
    const profile = (await c.query<{ owner_user_id: string }>("SELECT owner_user_id FROM app.buyer_profiles WHERE id = $1", [profileId])).rows[0];
    const property = (await c.query<{ address_label: string }>("SELECT address_label FROM app.properties WHERE id = $1", [propertyId])).rows[0];
    if (!profile || !property || profile.owner_user_id === ctx.user.id) return;
    // Un seul signalement ouvert par collègue et par bien.
    const already = await c.query(
      `SELECT 1 FROM app.tasks WHERE created_by = $1 AND assignee_user_id = $2 AND property_id = $3 AND status = 'a_faire' AND title LIKE 'Bien correspondant%'`,
      [ctx.user.id, profile.owner_user_id, propertyId],
    );
    if (already.rowCount) return;
    await c.query(
      `INSERT INTO app.tasks (org_id, assignee_user_id, created_by, title, details, property_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ctx.org.id, profile.owner_user_id, ctx.user.id, `Bien correspondant à l'un de vos acquéreurs (${score} %)`,
       `${ctx.user.name} signale que le bien « ${property.address_label} » correspond à ${score} % à l'un de vos profils de recherche.`, propertyId],
    );
  });
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "tache.creee", targetType: "bien", targetId: propertyId, details: { motif: "matching" } });
  revalidatePath(`/app/proprietes/${propertyId}`);
}

const taskSchema = z.object({
  title: z.string().trim().min(2, "Titre trop court.").max(200),
  assigneeUserId: UUID,
  dueOn: z.preprocess((v) => (v === "" ? null : v), z.iso.date().nullable()),
  details: optionalText(2000),
  contactId: z.preprocess((v) => (v === "" ? null : v), UUID.nullable()),
});

export async function createTaskAction(_prev: CrmState, form: FormData): Promise<CrmState> {
  const ctx = await requireAgency();
  const parsed = taskSchema.safeParse({
    title: form.get("title"), assigneeUserId: form.get("assigneeUserId") || ctx.user.id, dueOn: form.get("dueOn") ?? "",
    details: form.get("details"), contactId: form.get("contactId") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  const d = parsed.data;
  let taskId: string;
  try {
    taskId = await withTenant(getTenantPool(), tenant(ctx), async (_db, c) =>
      (await c.query<{ id: string }>(
        `INSERT INTO app.tasks (org_id, assignee_user_id, created_by, title, details, due_on, contact_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [ctx.org.id, d.assigneeUserId, ctx.user.id, d.title, d.details, d.dueOn, d.contactId],
      )).rows[0]!.id);
  } catch (e) {
    if (isDenied(e)) return { error: "Création de tâche refusée." };
    throw e;
  }
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "tache.creee", targetType: "tache", targetId: taskId });
  revalidatePath("/app/taches");
  if (d.contactId) revalidatePath(`/app/contacts/${d.contactId}`);
  return { success: "Tâche créée." };
}

export async function completeTaskAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  const id = UUID.parse(form.get("id"));
  const done = form.get("done") === "1";
  await withTenant(getTenantPool(), tenant(ctx), (_db, c) =>
    c.query(`UPDATE app.tasks SET status = $2, done_at = CASE WHEN $2 = 'faite' THEN now() ELSE NULL END WHERE id = $1`, [id, done ? "faite" : "a_faire"]));
  revalidatePath("/app/taches");
}
