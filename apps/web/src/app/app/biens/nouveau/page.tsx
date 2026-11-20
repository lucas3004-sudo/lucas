import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAgency } from "@/lib/agency/context";
import { Card, PageHeader } from "@/ui/surface";
import { NewDossierForm, type DossierDefaults } from "./new-dossier-form";

export const metadata: Metadata = { title: "Nouveau dossier" };

type Search = { label?: string; banId?: string; type?: string; surface?: string; rooms?: string };

export default async function NewDossierPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") redirect("/app/biens");
  // Pré-remplissage depuis la fiche d'un bien de l'agence (le serveur revérifie tout à la création).
  const s = await searchParams;
  const defaults: DossierDefaults = {
    address: s.label && s.banId ? { label: s.label.slice(0, 200), banId: s.banId.slice(0, 64) } : null,
    type: s.type === "Maison" ? "Maison" : "Appartement",
    surface: /^\d{1,4}(\.\d+)?$/.test(s.surface ?? "") ? s.surface! : "",
    rooms: /^\d{1,2}$/.test(s.rooms ?? "") ? s.rooms! : "",
  };
  return (
    <>
      <PageHeader
        title="Nouveau dossier de bien"
        description="Saisissez l'adresse et les caractéristiques du bien. Le calcul interroge les sources officielles : il prend quelques secondes."
      />
      <Card className="max-w-2xl">
        <NewDossierForm defaults={defaults} />
      </Card>
    </>
  );
}
