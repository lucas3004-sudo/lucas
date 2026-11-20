import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAgency } from "@/lib/agency/context";
import { getAgencySettings } from "@/lib/agency/settings";
import { agencyMembers } from "@/lib/crm/data";
import { Card, PageHeader } from "@/ui/surface";
import { PropertyForm } from "../../_crm/forms";
import { canAssignOwner } from "../../_crm/parts";

export const metadata: Metadata = { title: "Nouveau bien" };

export default async function NewPropertyPage() {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") redirect("/app/proprietes");
  const [members, settings] = await Promise.all([agencyMembers(ctx.org.id), getAgencySettings(ctx)]);
  return (
    <>
      <PageHeader title="Nouveau bien" description="L'adresse est vérifiée auprès de la Base Adresse Nationale. Les autres caractéristiques sont déclarées." />
      <Card className="max-w-3xl">
        <PropertyForm members={members} canAssign={canAssignOwner(ctx)} meId={ctx.user.id} defaultVisibility={settings.defaultVisibility} />
      </Card>
    </>
  );
}
