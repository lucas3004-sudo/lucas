import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAgency } from "@/lib/agency/context";
import { getAgencySettings } from "@/lib/agency/settings";
import { agencyMembers } from "@/lib/crm/data";
import { Card, PageHeader } from "@/ui/surface";
import { ContactForm } from "../../_crm/forms";
import { canAssignOwner } from "../../_crm/parts";

export const metadata: Metadata = { title: "Nouveau contact" };

export default async function NewContactPage() {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") redirect("/app/contacts");
  const [members, settings] = await Promise.all([agencyMembers(ctx.org.id), getAgencySettings(ctx)]);
  return (
    <>
      <PageHeader
        title="Nouveau contact"
        description="Seules les informations utiles au projet immobilier sont demandées. Les doublons probables sont signalés avant la création."
      />
      <Card className="max-w-3xl">
        <ContactForm members={members} canAssign={canAssignOwner(ctx)} meId={ctx.user.id} defaultVisibility={settings.defaultVisibility} />
      </Card>
    </>
  );
}
