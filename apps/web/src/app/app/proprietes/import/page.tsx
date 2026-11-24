import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAgency } from "@/lib/agency/context";
import { getAgencySettings } from "@/lib/agency/settings";
import { agencyMembers } from "@/lib/crm/data";
import { importPropertiesAction, previewPropertiesImportAction } from "@/lib/crm/import-actions";
import { Card, PageHeader } from "@/ui/surface";
import { ImportWizard } from "../../_crm/import-wizard";
import { canAssignOwner } from "../../_crm/parts";

export const metadata: Metadata = { title: "Importer des biens" };

const TEMPLATE =
  "Adresse;Code postal;Ville;Type;Surface;Pièces;Prix;DPE;Statut;Mandat;N° mandat;Date de mandat;Fin du mandat;Équipements;Notes\r\n" +
  "8 boulevard du Port;80000;Amiens;Appartement;62;3;250000;D;Mandat;Exclusif;M-2026-042;01/09/2026;01/12/2026;balcon, parking;\r\n";

export default async function ImportPropertiesPage() {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") redirect("/app/proprietes");
  const [members, settings] = await Promise.all([agencyMembers(ctx.org.id), getAgencySettings(ctx)]);
  return (
    <>
      <PageHeader
        title="Importer des biens"
        description="Colonnes reconnues : Adresse et Type (obligatoires), Code postal, Ville, Surface, Pièces, Prix, DPE, Statut, Mandat, N° mandat, Date de mandat, Fin du mandat (JJ/MM/AAAA), Équipements, Notes. Chaque adresse est vérifiée auprès de la Base Adresse Nationale (200 biens au maximum par fichier)."
      />
      <Card className="max-w-4xl">
        <ImportWizard
          previewAction={previewPropertiesImportAction}
          importAction={importPropertiesAction}
          noun="biens"
          template={TEMPLATE}
          templateName="modele-biens.csv"
          backHref="/app/proprietes"
          members={members}
          canAssign={canAssignOwner(ctx)}
          meId={ctx.user.id}
          defaultVisibility={settings.defaultVisibility}
          accept=".csv,text/csv,.zip,application/zip"
          fileHelp="Tableau Excel enregistré en CSV (1 Mo au maximum, noms de colonnes sur la première ligne), ou export de votre logiciel d'agence au format SeLoger « Poliris » (fichier ZIP ou Annonces.csv) : vos ventes d'appartements et de maisons sont reprises avec leur annonce, sans les photos."
        />
      </Card>
    </>
  );
}
