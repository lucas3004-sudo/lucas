import type { Metadata } from "next";
import { requireAgency } from "@/lib/agency/context";
import { canEditAgencyName, canEditSettings } from "@/lib/agency/rules";
import { getAgencySettings } from "@/lib/agency/settings";
import { Card, CardHeader, PageHeader } from "@/ui/surface";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const ctx = await requireAgency();
  const settings = await getAgencySettings(ctx);
  return (
    <>
      <PageHeader title="Paramètres de l'agence" />
      <Card>
        <CardHeader
          title="Général"
          description={
            canEditSettings(ctx.role)
              ? "Ces réglages s'appliquent à toute l'agence."
              : "Seuls le gérant et les managers peuvent modifier ces réglages."
          }
        />
        <SettingsForm
          name={ctx.org.name}
          defaultVisibility={settings.defaultVisibility}
          feeScheduleUrl={settings.feeScheduleUrl}
          canEdit={canEditSettings(ctx.role)}
          canRename={canEditAgencyName(ctx.role)}
        />
      </Card>
    </>
  );
}
