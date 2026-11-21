import type { Metadata } from "next";
import Link from "next/link";
import { getSession, requireAgency } from "@/lib/agency/context";
import { canEditAgencyName, canEditSettings } from "@/lib/agency/rules";
import { getAgencySettings } from "@/lib/agency/settings";
import { EXPORT_DATASETS } from "@/lib/export/agency";
import { buttonClass } from "@/ui/button";
import { Alert, Card, CardHeader, PageHeader } from "@/ui/surface";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const ctx = await requireAgency();
  const settings = await getAgencySettings(ctx);
  const session = await getSession();
  const twoFactorOn = Boolean((session?.user as { twoFactorEnabled?: boolean | null } | undefined)?.twoFactorEnabled);
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

      {ctx.role === "gerant" ? (
        <Card className="mt-4">
          <CardHeader
            title="Exporter les données de l'agence"
            description="Vos données vous appartiennent : un fichier CSV par type, lisible par Excel. Les colonnes des contacts et des biens sont celles de l'import. Chaque export est inscrit au journal d'audit."
          />
          {twoFactorOn ? (
            <ul className="flex flex-wrap gap-2 px-5 py-4">
              {Object.entries(EXPORT_DATASETS).map(([key, name]) => (
                <li key={key}>
                  <a href={`/api/v1/export/${key}`} download className={buttonClass("secondary", "sm")}>
                    {name} (.csv)
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-4">
              <Alert tone="warning">
                Un export complet est la cible n° 1 d&apos;un compte volé : activez d&apos;abord la{" "}
                <Link href="/app/securite" className="font-medium underline">double authentification</Link>.
              </Alert>
            </div>
          )}
        </Card>
      ) : null}
    </>
  );
}
