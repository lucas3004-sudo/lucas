/**
 * Rôles d'une agence (docs/phase-2/permissions.md).
 *
 * Better Auth contrôle ici uniquement la gestion de l'agence elle-même (paramètres,
 * membres, invitations). Les droits sur les données métier (contacts, biens…) sont
 * appliqués par la base (RLS) et par le code des routes.
 */
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

export const ROLES = ["gerant", "manager", "negociateur", "assistant", "lecture"] as const;
export type AgencyRole = (typeof ROLES)[number];

export const ROLE_LABELS: Record<AgencyRole, string> = {
  gerant: "Gérant",
  manager: "Manager",
  negociateur: "Négociateur",
  assistant: "Assistant(e)",
  lecture: "Lecture seule",
};

export const ROLE_DESCRIPTIONS: Record<AgencyRole, string> = {
  gerant: "Tous les droits, y compris la facturation et les rôles.",
  manager: "Gère l'équipe et voit toute l'agence, sans la facturation.",
  negociateur: "Ses contacts et biens, et ce qui est partagé avec l'agence.",
  assistant: "Saisie et mise à jour pour l'équipe, sans suppression ni export.",
  lecture: "Consultation de ce qui est partagé avec l'agence.",
};

export function isAgencyRole(value: string): value is AgencyRole {
  return (ROLES as readonly string[]).includes(value);
}

/** Rôles qu'un membre peut attribuer à d'autres (un manager ne nomme jamais un gérant). */
export function assignableRoles(actor: AgencyRole): AgencyRole[] {
  if (actor === "gerant") return [...ROLES];
  if (actor === "manager") return ["manager", "negociateur", "assistant", "lecture"];
  return [];
}

export const ac = createAccessControl(defaultStatements);

export const agencyRoles = {
  gerant: ac.newRole({
    organization: ["update", "delete"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
  }),
  manager: ac.newRole({
    member: ["create", "update"],
    invitation: ["create", "cancel"],
  }),
  negociateur: ac.newRole({}),
  assistant: ac.newRole({}),
  lecture: ac.newRole({}),
};
