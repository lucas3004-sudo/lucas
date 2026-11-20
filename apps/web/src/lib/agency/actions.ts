"use server";
/**
 * Actions serveur de gestion de l'agence. Chaque action :
 *   1. vérifie la session et le rôle de l'AUTEUR (lu par la base) ;
 *   2. applique les règles de rules.ts ;
 *   3. appelle Better Auth côté serveur (les routes HTTP équivalentes sont fermées) ;
 *   4. journalise l'action dans app.audit_log.
 */
import { schema, withTenant } from "@immopilot/db";
import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { audit } from "../audit";
import { getAuth } from "../auth/server";
import { ROLES } from "../auth/roles";
import { appUrl } from "../server/env";
import { getTenantPool } from "../server/db";
import { requireAgency, requireUser, roleInAgency } from "./context";
import { agencySlug, canChangeRole, canEditAgencyName, canEditSettings, canInvite, canRemoveMember } from "./rules";

export type ActionState = { error?: string; success?: string; link?: string };

const KNOWN_ERRORS: Record<string, string> = {
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: "Cette personne fait déjà partie de l'agence.",
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: "Une invitation est déjà en attente pour cette adresse.",
  ORGANIZATION_ALREADY_EXISTS: "Une agence porte déjà cet identifiant. Réessayez.",
  INVITATION_NOT_FOUND: "Invitation introuvable, expirée ou déjà utilisée.",
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: "Cette invitation a été envoyée à une autre adresse e-mail.",
};

function failure(error: unknown, fallback: string): ActionState {
  if (error instanceof APIError) {
    const code = (error.body as { code?: string } | undefined)?.code;
    if (code && KNOWN_ERRORS[code]) return { error: KNOWN_ERRORS[code] };
  }
  console.error(fallback, error);
  return { error: fallback };
}

async function teamSnapshot(orgId: string) {
  const full = await getAuth().api.getFullOrganization({
    headers: await headers(),
    query: { organizationId: orgId },
  });
  const members = full?.members ?? [];
  return { members, gerantCount: members.filter((m) => m.role === "gerant").length };
}

// --- Agence -------------------------------------------------------------------------------

const agencyName = z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(80, "80 caractères au maximum.");

export async function createAgencyAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = agencyName.safeParse(form.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nom invalide." };

  let orgId: string;
  try {
    const org = await getAuth().api.createOrganization({
      headers: await headers(),
      body: { name: parsed.data, slug: agencySlug(parsed.data, randomBytes(3).toString("hex")) },
    });
    if (!org) return { error: "La création de l'agence a échoué." };
    orgId = org.id;
  } catch (error) {
    return failure(error, "La création de l'agence a échoué.");
  }
  await audit({ orgId, userId: user.id, action: "agence.creee", targetType: "agence", targetId: orgId, details: { name: parsed.data } });
  redirect("/app");
}

/** Après la connexion : active la première agence de l'utilisateur, ou l'envoie en créer une. */
export async function enterAppAction(): Promise<string> {
  await requireUser();
  const h = await headers();
  const orgs = await getAuth().api.listOrganizations({ headers: h });
  const first = orgs[0];
  if (!first) return "/agence/nouvelle";
  await getAuth().api.setActiveOrganization({ headers: h, body: { organizationId: first.id } });
  return "/app";
}

export async function switchAgencyAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const orgId = String(form.get("organizationId") ?? "");
  if (!(await roleInAgency(orgId, user.id))) redirect("/agence");
  await getAuth().api.setActiveOrganization({ headers: await headers(), body: { organizationId: orgId } });
  redirect("/app");
}

const settingsSchema = z.object({
  name: agencyName,
  defaultVisibility: z.enum(["private", "agency"]),
});

export async function updateSettingsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAgency();
  if (!canEditSettings(ctx.role)) return { error: "Seuls le gérant et les managers peuvent modifier les paramètres." };
  const parsed = settingsSchema.safeParse({ name: form.get("name"), defaultVisibility: form.get("defaultVisibility") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeurs invalides." };

  if (parsed.data.name !== ctx.org.name) {
    if (!canEditAgencyName(ctx.role)) return { error: "Seul le gérant peut renommer l'agence." };
    try {
      await getAuth().api.updateOrganization({
        headers: await headers(),
        body: { organizationId: ctx.org.id, data: { name: parsed.data.name } },
      });
    } catch (error) {
      return failure(error, "Le renommage de l'agence a échoué.");
    }
    await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "agence.renommee", details: { avant: ctx.org.name, apres: parsed.data.name } });
  }

  // La base vérifie elle-même le rôle (politiques settings_insert / settings_update).
  await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, (db) =>
    db
      .insert(schema.organizationSettings)
      .values({ orgId: ctx.org.id, defaultVisibility: parsed.data.defaultVisibility, updatedBy: ctx.user.id })
      .onConflictDoUpdate({
        target: schema.organizationSettings.orgId,
        set: { defaultVisibility: parsed.data.defaultVisibility, updatedBy: ctx.user.id, updatedAt: new Date() },
      }),
  );
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "agence.parametres_modifies", details: { visibiliteParDefaut: parsed.data.defaultVisibility } });
  revalidatePath("/app", "layout");
  return { success: "Paramètres enregistrés." };
}

// --- Équipe -------------------------------------------------------------------------------

const inviteSchema = z.object({
  email: z.email("Adresse e-mail invalide.").trim().toLowerCase(),
  role: z.enum(ROLES, "Rôle inconnu."),
});

export async function inviteMemberAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAgency();
  const parsed = inviteSchema.safeParse({ email: form.get("email"), role: form.get("role") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  const rule = canInvite(ctx.role, parsed.data.role);
  if (!rule.ok) return { error: rule.message };

  let invitationId: string;
  try {
    const invitation = await getAuth().api.createInvitation({
      headers: await headers(),
      body: { email: parsed.data.email, role: parsed.data.role, organizationId: ctx.org.id },
    });
    invitationId = invitation.id;
  } catch (error) {
    return failure(error, "L'invitation a échoué.");
  }
  await audit({
    orgId: ctx.org.id, userId: ctx.user.id, action: "equipe.invitation_creee",
    targetType: "invitation", targetId: invitationId, details: { email: parsed.data.email, role: parsed.data.role },
  });
  revalidatePath("/app/equipe");
  return { success: `Invitation créée pour ${parsed.data.email}.`, link: `${appUrl()}/invitation/${invitationId}` };
}

export async function cancelInvitationAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  const invitationId = String(form.get("invitationId") ?? "");
  if (ctx.role !== "gerant" && ctx.role !== "manager") return;
  await getAuth().api.cancelInvitation({ headers: await headers(), body: { invitationId } });
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "equipe.invitation_annulee", targetType: "invitation", targetId: invitationId });
  revalidatePath("/app/equipe");
}

export async function changeRoleAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAgency();
  const memberId = String(form.get("memberId") ?? "");
  const newRole = String(form.get("role") ?? "");
  const { members, gerantCount } = await teamSnapshot(ctx.org.id);
  const target = members.find((m) => m.id === memberId);
  if (!target) return { error: "Membre introuvable." };
  const rule = canChangeRole({
    actor: ctx.role, actorUserId: ctx.user.id, targetUserId: target.userId,
    targetRole: target.role, newRole, gerantCount,
  });
  if (!rule.ok) return { error: rule.message };
  try {
    await getAuth().api.updateMemberRole({
      headers: await headers(),
      body: { memberId, role: newRole, organizationId: ctx.org.id },
    });
  } catch (error) {
    return failure(error, "Le changement de rôle a échoué.");
  }
  await audit({
    orgId: ctx.org.id, userId: ctx.user.id, action: "equipe.role_modifie", targetType: "membre", targetId: memberId,
    details: { membre: target.user.email, avant: target.role, apres: newRole },
  });
  revalidatePath("/app/equipe");
  return { success: "Rôle modifié." };
}

export async function removeMemberAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAgency();
  const memberId = String(form.get("memberId") ?? "");
  const { members, gerantCount } = await teamSnapshot(ctx.org.id);
  const target = members.find((m) => m.id === memberId);
  if (!target) return { error: "Membre introuvable." };
  const rule = canRemoveMember({
    actor: ctx.role, actorUserId: ctx.user.id, targetUserId: target.userId, targetRole: target.role, gerantCount,
  });
  if (!rule.ok) return { error: rule.message };
  try {
    await getAuth().api.removeMember({
      headers: await headers(),
      body: { memberIdOrEmail: memberId, organizationId: ctx.org.id },
    });
  } catch (error) {
    return failure(error, "Le retrait du membre a échoué.");
  }
  await audit({
    orgId: ctx.org.id, userId: ctx.user.id, action: "equipe.membre_retire", targetType: "membre", targetId: memberId,
    details: { membre: target.user.email, role: target.role },
  });
  revalidatePath("/app/equipe");
  return { success: `${target.user.name} a été retiré(e) de l'agence.` };
}

export async function acceptInvitationAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const invitationId = String(form.get("invitationId") ?? "");
  let orgId: string;
  try {
    const result = await getAuth().api.acceptInvitation({ headers: await headers(), body: { invitationId } });
    if (!result?.invitation) return { error: KNOWN_ERRORS.INVITATION_NOT_FOUND };
    orgId = result.invitation.organizationId;
    await getAuth().api.setActiveOrganization({ headers: await headers(), body: { organizationId: orgId } });
  } catch (error) {
    return failure(error, "L'acceptation de l'invitation a échoué.");
  }
  await audit({ orgId, userId: user.id, action: "equipe.invitation_acceptee", targetType: "invitation", targetId: invitationId });
  redirect("/app");
}

export async function signOutAction(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/connexion");
}
