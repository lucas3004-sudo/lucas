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
  | "equipe.membre_retire"
  | "dossier.cree"
  | "dossier.supprime"
  | "contact.cree"
  | "contact.modifie"
  | "contact.supprime"
  | "consentement.enregistre"
  | "profil.cree"
  | "bien_agence.cree"
  | "bien_agence.supprime"
  | "tache.creee";

export const AUDIT_LABELS: Record<AuditAction, string> = {
  "agence.creee": "Agence créée",
  "agence.renommee": "Agence renommée",
  "agence.parametres_modifies": "Paramètres modifiés",
  "equipe.invitation_creee": "Invitation envoyée",
  "equipe.invitation_annulee": "Invitation annulée",
  "equipe.invitation_acceptee": "Invitation acceptée",
  "equipe.role_modifie": "Rôle modifié",
  "equipe.membre_retire": "Membre retiré",
  "dossier.cree": "Dossier de bien créé",
  "dossier.supprime": "Dossier de bien supprimé",
  "contact.cree": "Contact créé",
  "contact.modifie": "Contact modifié",
  "contact.supprime": "Contact supprimé",
  "consentement.enregistre": "Consentement enregistré",
  "profil.cree": "Profil de recherche créé",
  "bien_agence.cree": "Bien de l'agence créé",
  "bien_agence.supprime": "Bien de l'agence supprimé",
  "tache.creee": "Tâche créée",
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
