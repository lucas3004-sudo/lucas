import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAgency } from "@/lib/agency/context";
import { getAgencySettings } from "@/lib/agency/settings";
import { agencyMembers } from "@/lib/crm/data";
import { Card, PageHeader } from "@/ui/surface";
import { PropertyForm } from "../../_crm/forms";
import { canAssignOwner } from "../../_crm/parts";

export const metadata: Metadata = { title: "Nouveau bien" };

export default async function NewPropertyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") redirect("/app/proprietes");
  const prospection = (await searchParams).prospection === "1";
  const [members, settings] = await Promise.all([agencyMembers(ctx.org.id), getAgencySettings(ctx)]);
  return (
    <>
      <PageHeader
        title={prospection ? "Ajouter un bien repéré" : "Nouveau bien"}
        description={
          prospection
            ? "Un bien que vous aimeriez rentrer en mandat : annonce de particulier, bouche-à-oreille, panneau « à vendre ». Il rejoint votre prospection, « à contacter »."
            : "L'adresse est vérifiée auprès de la Base Adresse Nationale. Les autres caractéristiques sont déclarées."
        }
      />
      <Card className="max-w-3xl">
        <PropertyForm members={members} canAssign={canAssignOwner(ctx)} meId={ctx.user.id} defaultVisibility={settings.defaultVisibility} prospection={prospection} />
      </Card>
    </>
  );
}
