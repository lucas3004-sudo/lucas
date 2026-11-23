import type { Metadata } from "next";
import { requireAgency } from "@/lib/agency/context";
import { mapProperties } from "@/lib/map/data";
import { PageHeader } from "@/ui/surface";
import { MapView } from "./map-view";

export const metadata: Metadata = { title: "Carte" };

export default async function MapPage() {
  const ctx = await requireAgency();
  const properties = await mapProperties(ctx);
  return (
    <>
      <PageHeader
        title="Carte des biens"
        description="Les biens de l'agence selon vos critères, les ventes réelles autour, et les biens affichés sous le prix du marché. Les annonces des autres agences et des particuliers ne sont pas incluses."
      />
      <MapView properties={properties} />
    </>
  );
}
