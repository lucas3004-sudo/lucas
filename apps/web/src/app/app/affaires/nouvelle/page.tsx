import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAgency } from "@/lib/agency/context";
import { agencyMembers, contactName, listContacts, listProperties } from "@/lib/crm/data";
import { Card, PageHeader } from "@/ui/surface";
import { canAssignOwner } from "../../_crm/parts";
import { NewDealForm } from "../deal-forms";

export const metadata: Metadata = { title: "Nouvelle affaire" };

export default async function NewDealPage({ searchParams }: { searchParams: Promise<{ bien?: string }> }) {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") redirect("/app/affaires");
  const bien = (await searchParams).bien ?? "";
  const [properties, contacts, members] = await Promise.all([listProperties(ctx), listContacts(ctx), agencyMembers(ctx.org.id)]);
  const options = properties.filter((p) => p.status !== "vendu" && p.status !== "retire").map((p) => ({ id: p.id, label: p.address_label }));
  return (
    <>
      <PageHeader title="Nouvelle affaire" description="Une offre a été acceptée : ouvrez l'affaire pour suivre les étapes jusqu'à l'acte." />
      <Card className="max-w-3xl">
        <NewDealForm
          properties={options}
          contacts={contacts.map((c) => ({ id: c.id, label: contactName(c) }))}
          members={members}
          meId={ctx.user.id}
          canAssign={canAssignOwner(ctx)}
          defaultPropertyId={options.some((o) => o.id === bien) ? bien : ""}
        />
      </Card>
    </>
  );
}
