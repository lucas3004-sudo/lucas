import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAgency } from "@/lib/agency/context";
import { getAgencySettings } from "@/lib/agency/settings";
import { agencyMembers } from "@/lib/crm/data";
import { importContactsAction, previewContactsImportAction } from "@/lib/crm/import-actions";
import { Card, PageHeader } from "@/ui/surface";
import { ImportWizard } from "../../_crm/import-wizard";
import { canAssignOwner } from "../../_crm/parts";

export const metadata: Metadata = { title: "Importer des contacts" };

const TEMPLATE = "Prénom;Nom;E-mail;Téléphone;Rôle;Origine;Notes\r\nÉlodie;Exemple;elodie@exemple.invalid;06 00 00 00 00;Acquéreur;Salon;\r\n";

export default async function ImportContactsPage() {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") redirect("/app/contacts");
  const [members, settings] = await Promise.all([agencyMembers(ctx.org.id), getAgencySettings(ctx)]);
  return (
    <>
      <PageHeader
        title="Importer des contacts"
        description="Colonnes reconnues : Prénom, Nom (obligatoire), E-mail, Téléphone, Rôle (acquéreur, vendeur, investisseur, bailleur, locataire), Origine, Notes."
      />
      <Card className="max-w-4xl">
        <ImportWizard
          previewAction={previewContactsImportAction}
          importAction={importContactsAction}
          noun="contacts"
          template={TEMPLATE}
          templateName="modele-contacts.csv"
          backHref="/app/contacts"
          members={members}
          canAssign={canAssignOwner(ctx)}
          meId={ctx.user.id}
          defaultVisibility={settings.defaultVisibility}
          notice="Les consentements de prospection ne sont pas importés : ils exigent une preuve, à enregistrer sur la fiche de chaque contact avant tout démarchage."
        />
      </Card>
    </>
  );
}
