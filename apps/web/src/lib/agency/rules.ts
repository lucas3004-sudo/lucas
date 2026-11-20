/**
 * Règles de gestion de l'équipe (docs/phase-2/permissions.md). Fonctions pures, testées.
 * Elles sont appliquées côté serveur AVANT tout appel à Better Auth, car les routes HTTP de
 * gestion d'agence sont fermées (options.ts, DISABLED_ORGANIZATION_PATHS).
 */
import { assignableRoles, isAgencyRole, type AgencyRole } from "../auth/roles";

export type RuleResult = { ok: true } | { ok: false; message: string };

const OK: RuleResult = { ok: true };
const deny = (message: string): RuleResult => ({ ok: false, message });

export function canManageTeam(actor: AgencyRole): boolean {
  return actor === "gerant" || actor === "manager";
}

export function canInvite(actor: AgencyRole, role: string): RuleResult {
  if (!canManageTeam(actor)) return deny("Seuls le gérant et les managers peuvent inviter.");
  if (!isAgencyRole(role)) return deny("Rôle inconnu.");
  if (!assignableRoles(actor).includes(role)) return deny("Vous ne pouvez pas attribuer ce rôle.");
  return OK;
}

export function canChangeRole(params: {
  actor: AgencyRole;
  actorUserId: string;
  targetUserId: string;
  targetRole: string;
  newRole: string;
  gerantCount: number;
}): RuleResult {
  const { actor, actorUserId, targetUserId, targetRole, newRole, gerantCount } = params;
  if (!canManageTeam(actor)) return deny("Seuls le gérant et les managers peuvent changer un rôle.");
  if (!isAgencyRole(newRole)) return deny("Rôle inconnu.");
  if (targetRole === newRole) return deny("Ce membre a déjà ce rôle.");
  if (targetRole === "gerant" && actor !== "gerant") return deny("Seul un gérant peut modifier le rôle d'un gérant.");
  if (!assignableRoles(actor).includes(newRole)) return deny("Vous ne pouvez pas attribuer ce rôle.");
  if (targetRole === "gerant" && gerantCount <= 1) return deny("L'agence doit garder au moins un gérant.");
  if (actorUserId === targetUserId && actor === "manager") return deny("Vous ne pouvez pas modifier votre propre rôle.");
  return OK;
}

export function canRemoveMember(params: {
  actor: AgencyRole;
  actorUserId: string;
  targetUserId: string;
  targetRole: string;
  gerantCount: number;
}): RuleResult {
  const { actor, actorUserId, targetUserId, targetRole, gerantCount } = params;
  if (!canManageTeam(actor)) return deny("Seuls le gérant et les managers peuvent retirer un membre.");
  if (actorUserId === targetUserId) return deny("Vous ne pouvez pas vous retirer vous-même de l'agence.");
  if (targetRole === "gerant" && actor !== "gerant") return deny("Seul un gérant peut retirer un gérant.");
  if (targetRole === "gerant" && gerantCount <= 1) return deny("L'agence doit garder au moins un gérant.");
  return OK;
}

export function canEditAgencyName(actor: AgencyRole): boolean {
  return actor === "gerant";
}

export function canEditSettings(actor: AgencyRole): boolean {
  return actor === "gerant" || actor === "manager";
}

export function canReadAuditLog(actor: AgencyRole): boolean {
  return actor === "gerant" || actor === "manager";
}

/** Identifiant d'URL de l'agence : nom simplifié + suffixe aléatoire (unicité sans fuite d'information). */
export function agencySlug(name: string, randomSuffix: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "agence"}-${randomSuffix}`;
}
