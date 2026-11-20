import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ invitation?: string }> }) {
  const { invitation } = await searchParams;
  const invitationQuery = invitation ? `?invitation=${encodeURIComponent(invitation)}` : "";
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Créer un compte</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {invitation
          ? "Utilisez l'adresse e-mail à laquelle l'invitation a été envoyée."
          : "Vous créerez ensuite l'espace de votre agence."}
      </p>
      <div className="mt-8">
        <SignUpForm invitation={invitation} />
      </div>
      <p className="mt-6 text-sm text-ink-muted">
        Déjà un compte ?{" "}
        <Link href={`/connexion${invitationQuery}`} className="font-medium text-brand-text hover:underline">
          Se connecter
        </Link>
      </p>
    </>
  );
}
