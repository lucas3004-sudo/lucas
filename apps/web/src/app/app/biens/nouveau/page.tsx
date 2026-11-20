import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAgency } from "@/lib/agency/context";
import { Card, PageHeader } from "@/ui/surface";
import { NewDossierForm } from "./new-dossier-form";

export const metadata: Metadata = { title: "Nouveau dossier" };

export default async function NewDossierPage() {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") redirect("/app/biens");
  return (
    <>
      <PageHeader
        title="Nouveau dossier de bien"
        description="Saisissez l'adresse et les caractéristiques du bien. Le calcul interroge les sources officielles : il prend quelques secondes."
      />
      <Card className="max-w-2xl">
        <NewDossierForm />
      </Card>
    </>
  );
}
