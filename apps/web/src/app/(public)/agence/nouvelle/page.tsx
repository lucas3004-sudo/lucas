import type { Metadata } from "next";
import { requireUser } from "@/lib/agency/context";
import { CreateAgencyForm } from "./create-agency-form";

export const metadata: Metadata = { title: "Créer votre agence" };

export default async function NewAgencyPage() {
  const user = await requireUser();
  return (
    <>
      <p className="text-sm font-medium text-brand-text">Bienvenue, {user.name.split(" ")[0]}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Créer l&apos;espace de votre agence</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Vous en serez le gérant. Vous pourrez ensuite inviter votre équipe et attribuer les rôles.
      </p>
      <div className="mt-8">
        <CreateAgencyForm />
      </div>
    </>
  );
}
