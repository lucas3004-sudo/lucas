/**
 * Contexte de la requête : utilisateur connecté, agence active et rôle.
 * Le rôle est lu PAR LA BASE (app.ctx_role(), la même fonction que les politiques RLS) :
 * l'interface et l'isolation des données s'appuient donc sur la même source.
 */
import { currentRole, withTenant } from "@immopilot/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isAgencyRole, type AgencyRole } from "../auth/roles";
import { getAuth } from "../auth/server";
import { getTenantPool } from "../server/db";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export interface AgencyContext {
  user: SessionUser;
  org: { id: string; name: string; slug: string; createdAt: Date };
  role: AgencyRole;
}

export const getSession = cache(async () => {
  return getAuth().api.getSession({ headers: await headers() });
});

/** Utilisateur connecté, sinon redirection vers la connexion. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/connexion");
  return { id: session.user.id, name: session.user.name, email: session.user.email };
}

export async function roleInAgency(orgId: string, userId: string): Promise<AgencyRole | null> {
  const role = await withTenant(getTenantPool(), { orgId, userId }, (_db, client) => currentRole(client));
  return role && isAgencyRole(role) ? role : null;
}

/**
 * Agence active et rôle, sinon redirection :
 * - pas connecté → /connexion ;
 * - pas d'agence active → /agence (choix ou création).
 */
export const requireAgency = cache(async (): Promise<AgencyContext> => {
  const session = await getSession();
  if (!session) redirect("/connexion");
  const orgId = session.session.activeOrganizationId;
  if (!orgId) redirect("/agence");

  const user = { id: session.user.id, name: session.user.name, email: session.user.email };
  const role = await roleInAgency(orgId, user.id);
  if (!role) redirect("/agence");

  const orgs = await getAuth().api.listOrganizations({ headers: await headers() });
  const org = orgs.find((o) => o.id === orgId);
  if (!org) redirect("/agence");

  return { user, org: { id: org.id, name: org.name, slug: org.slug, createdAt: new Date(org.createdAt) }, role };
});
