import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ invitation?: string }> }) {
  const { invitation } = await searchParams;
  const invitationQuery = invitation ? `?invitation=${encodeURIComponent(invitation)}` : "";
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Connexion</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Accédez à l&apos;espace de votre agence.</p>
      <div className="mt-8">
        <SignInForm invitation={invitation} />
      </div>
      <p className="mt-6 text-sm text-ink-muted">
        Pas encore de compte ?{" "}
        <Link href={`/inscription${invitationQuery}`} className="font-medium text-brand-text hover:underline">
          Créer un compte
        </Link>
      </p>
    </>
  );
}
