/**
 * Journal d'audit de l'agence (table app.audit_log, ajout seul).
 * Écrit avec l'identité de l'auteur : la base refuse d'enregistrer une action au nom d'un autre.
 */
import { schema, withTenant } from "@immopilot/db";
import { getTenantPool } from "./server/db";

export type AuditAction =
  | "agence.creee"
  | "agence.renommee"
  | "agence.parametres_modifies"
  | "equipe.invitation_creee"
  | "equipe.invitation_annulee"
  | "equipe.invitation_acceptee"
  | "equipe.role_modifie"
  | "equipe.membre_retire";

export const AUDIT_LABELS: Record<AuditAction, string> = {
  "agence.creee": "Agence créée",
  "agence.renommee": "Agence renommée",
  "agence.parametres_modifies": "Paramètres modifiés",
  "equipe.invitation_creee": "Invitation envoyée",
  "equipe.invitation_annulee": "Invitation annulée",
  "equipe.invitation_acceptee": "Invitation acceptée",
  "equipe.role_modifie": "Rôle modifié",
  "equipe.membre_retire": "Membre retiré",
};

export async function audit(params: {
  orgId: string;
  userId: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}) {
  const { orgId, userId, action, targetType, targetId, details } = params;
  await withTenant(getTenantPool(), { orgId, userId }, (db) =>
    db.insert(schema.auditLog).values({
      orgId,
      actorUserId: userId,
      action,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      details: details ?? {},
    }),
  );
}
