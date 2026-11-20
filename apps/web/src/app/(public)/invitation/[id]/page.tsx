import type { Metadata } from "next";
import { headers } from "next/headers";
import { getSession } from "@/lib/agency/context";
import { ROLE_LABELS, isAgencyRole } from "@/lib/auth/roles";
import { getAuth } from "@/lib/auth/server";
import { LinkButton } from "@/ui/button";
import { Alert } from "@/ui/surface";
import { AcceptInvitationForm } from "./accept-form";

export const metadata: Metadata = { title: "Invitation" };

export default async function InvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  if (!session) {
    const query = `?invitation=${encodeURIComponent(id)}`;
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Vous êtes invité(e)</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Pour rejoindre l&apos;agence, connectez-vous ou créez un compte avec l&apos;adresse e-mail qui a reçu
          l&apos;invitation.
        </p>
        <div className="mt-8 grid gap-2">
          <LinkButton href={`/inscription${query}`}>Créer un compte</LinkButton>
          <LinkButton href={`/connexion${query}`} variant="secondary">
            J&apos;ai déjà un compte
          </LinkButton>
        </div>
      </>
    );
  }

  let invitation: Awaited<ReturnType<ReturnType<typeof getAuth>["api"]["getInvitation"]>> | null = null;
  try {
    invitation = await getAuth().api.getInvitation({ headers: await headers(), query: { id } });
  } catch {
    invitation = null;
  }

  if (!invitation || invitation.status !== "pending") {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Invitation indisponible</h1>
        <div className="mt-6">
          <Alert tone="warning">
            Cette invitation est introuvable, expirée, déjà utilisée, ou destinée à une autre adresse que{" "}
            <strong>{session.user.email}</strong>.
          </Alert>
        </div>
        <LinkButton href="/" variant="secondary" className="mt-6 w-full">
          Retour
        </LinkButton>
      </>
    );
  }

  const role = invitation.role && isAgencyRole(invitation.role) ? ROLE_LABELS[invitation.role] : invitation.role;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Rejoindre {invitation.organizationName}</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {invitation.inviterEmail} vous invite à rejoindre l&apos;agence avec le rôle <strong>{role}</strong>.
      </p>
      <div className="mt-8">
        <AcceptInvitationForm invitationId={invitation.id} />
      </div>
    </>
  );
}
