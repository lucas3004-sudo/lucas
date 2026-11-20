/**
 * Configuration Better Auth partagée entre l'application et le script de génération du schéma.
 *
 * La bibliothèque se connecte avec le rôle app_auth, limité au schéma « auth »
 * (docs/phase-2/architecture.md, section 3). Les données des agences ne sont jamais
 * lues par cette connexion.
 */
import type { BetterAuthOptions } from "better-auth";
import { organization } from "better-auth/plugins/organization";
import { Pool } from "pg";
import { ac, agencyRoles } from "./roles";

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

/**
 * Routes HTTP de gestion d'agence FERMÉES (réponse 404).
 * Les hooks de Better Auth reçoivent le membre visé, pas l'auteur de l'action : ils ne
 * permettent pas d'empêcher un manager de nommer un gérant en appelant l'API directement.
 * Toutes ces opérations passent donc par les actions serveur de src/lib/agency, qui vérifient
 * le rôle de l'auteur (rules.ts) et journalisent l'action. Les appels serveur (auth.api.*)
 * ne sont pas concernés par disabledPaths.
 */
export const DISABLED_ORGANIZATION_PATHS = [
  "accept-invitation", "add-team-member", "cancel-invitation", "check-slug", "create", "create-role",
  "create-team", "delete", "delete-role", "get-active-member", "get-active-member-role",
  "get-full-organization", "get-invitation", "get-organization", "get-role", "invite-member", "leave",
  "list", "list-invitations", "list-members", "list-roles", "list-team-members", "list-teams",
  "list-user-invitations", "list-user-teams", "reject-invitation", "remove-member", "remove-team",
  "remove-team-member", "set-active", "set-active-team", "update", "update-member-role", "update-role",
  "update-team",
].map((path) => `/organization/${path}`);

export function createAuthPool(connectionString: string) {
  return new Pool({ connectionString, options: "-c search_path=auth", max: 5 });
}

export function authOptions(pool: Pool) {
  return {
    appName: "ImmoPilot AI",
    database: pool,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      // Pas encore de service d'e-mail (il demande un compte externe) : la vérification
      // d'adresse sera activée avec lui. Voir PROGRESS.md.
      requireEmailVerification: false,
    },
    session: {
      expiresIn: SEVEN_DAYS_IN_SECONDS,
      updateAge: 24 * 60 * 60,
    },
    advanced: {
      database: { generateId: "uuid" },
      useSecureCookies: process.env.NODE_ENV === "production",
    },
    disabledPaths: DISABLED_ORGANIZATION_PATHS,
    // Compteur en base : fonctionne aussi avec plusieurs instances (hébergement sans serveur).
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      // Le compteur est par adresse IP : toute une agence partage souvent la même IP de bureau.
      // 10 connexions par minute laissent arriver une équipe le matin, tout en freinant la force
      // brute (mots de passe de 12 caractères minimum). Constaté en test le 2026-11-20.
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
    plugins: [
      organization({
        ac,
        roles: agencyRoles,
        creatorRole: "gerant",
        allowUserToCreateOrganization: true,
        invitationExpiresIn: SEVEN_DAYS_IN_SECONDS,
        // Sans service d'e-mail, l'invitation est un lien à copier dans l'écran Équipe.
        sendInvitationEmail: async () => {},
      }),
    ],
  } satisfies BetterAuthOptions;
}
