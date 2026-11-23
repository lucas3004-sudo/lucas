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
  | "contact.exporte"
  | "consentement.enregistre"
  | "profil.cree"
  | "bien_agence.cree"
  | "bien_agence.supprime"
  | "tache.creee"
  | "rdv.cree"
  | "rdv.annule"
  | "contacts.importes"
  | "biens.importes"
  | "affaire.creee"
  | "affaire.etape"
  | "photo.ajoutee"
  | "photo.supprimee"
  | "agent.mission"
  | "agent.reglage"
  | "approbation.decidee"
  | "visite.compte_rendu"
  | "bien_agence.mandat"
  | "agence.export"
  | "abonnement.paiement_ouvert"
  | "abonnement.portail_ouvert";

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
  "contact.exporte": "Données d'un contact exportées (RGPD)",
  "consentement.enregistre": "Consentement enregistré",
  "profil.cree": "Profil de recherche créé",
  "bien_agence.cree": "Bien de l'agence créé",
  "bien_agence.supprime": "Bien de l'agence supprimé",
  "tache.creee": "Tâche créée",
  "rdv.cree": "Rendez-vous planifié",
  "rdv.annule": "Rendez-vous annulé",
  "contacts.importes": "Contacts importés (CSV)",
  "biens.importes": "Biens importés (CSV)",
  "affaire.creee": "Affaire ouverte",
  "affaire.etape": "Étape d'affaire modifiée",
  "photo.ajoutee": "Photo de bien ajoutée",
  "photo.supprimee": "Photo de bien supprimée",
  "agent.mission": "Mission d'agent lancée",
  "agent.reglage": "Agent activé ou désactivé",
  "approbation.decidee": "Demande d'approbation décidée",
  "visite.compte_rendu": "Compte rendu de visite enregistré",
  "bien_agence.mandat": "Mandat d'un bien modifié",
  "agence.export": "Données de l'agence exportées (CSV)",
  "abonnement.paiement_ouvert": "Page de paiement d'abonnement ouverte",
  "abonnement.portail_ouvert": "Gestion de l'abonnement ouverte",
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
