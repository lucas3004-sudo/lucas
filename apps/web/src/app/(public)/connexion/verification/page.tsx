import type { Metadata } from "next";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Vérification en deux étapes" };

export default async function VerificationPage({ searchParams }: { searchParams: Promise<{ invitation?: string }> }) {
  const { invitation } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Vérification en deux étapes</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Saisissez le code à 6 chiffres affiché par votre application d&apos;authentification.</p>
      <div className="mt-8">
        <VerifyForm invitation={invitation} />
      </div>
    </>
  );
}
