import type { Metadata } from "next";
import Link from "next/link";
import { getSession, requireAgency } from "@/lib/agency/context";
import { canEditAgencyName, canEditSettings } from "@/lib/agency/rules";
import { getAgencySettings } from "@/lib/agency/settings";
import { agencyMembers } from "@/lib/crm/data";
import { EXPORT_DATASETS } from "@/lib/export/agency";
import { publicPageSettings } from "@/lib/public/settings";
import { setPublicPageAction } from "@/lib/public/settings-actions";
import { appUrl } from "@/lib/server/env";
import { CopyField, SubmitButton } from "@/ui/client";
import { Check, Field, Select } from "@/ui/form";
import { buttonClass } from "@/ui/button";
import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/ui/surface";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Paramètres" };

const PAGE_MESSAGES: Record<string, { tone: "success" | "danger"; text: string }> = {
  ok: { tone: "success", text: "Page « Estimez votre bien » enregistrée." },
  destinataire: { tone: "danger", text: "Choisissez un membre de l'agence pour recevoir les demandes." },
  droits: { tone: "danger", text: "Seuls le gérant et les managers peuvent régler cette page." },
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const ctx = await requireAgency();
  const [settings, publicPage, members, { page: pageStatus }] = await Promise.all([
    getAgencySettings(ctx), publicPageSettings(ctx), agencyMembers(ctx.org.id), searchParams,
  ]);
  const canManagePage = ctx.role === "gerant" || ctx.role === "manager";
  const publicUrl = `${appUrl()}/estimer/${ctx.org.slug}`;
  const pageMessage = pageStatus ? PAGE_MESSAGES[pageStatus] : undefined;
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

      <div id="page-estimation" className="mt-4 scroll-mt-20">
        <Card>
          <CardHeader
            title="Page « Estimez votre bien »"
            description="Une page à votre nom, à mettre sur votre site, votre fiche Google ou vos réseaux : un propriétaire obtient une estimation indicative (ventes réelles DVF) et peut demander à être rappelé. Sa demande arrive ici, avec son accord : contact vendeur, bien à prospecter et tâche de rappel."
          />
          <CardBody className="space-y-4 text-sm">
            {pageMessage ? <Alert tone={pageMessage.tone}>{pageMessage.text}</Alert> : null}
            {publicPage.enabled ? (
              <CopyField label="Lien de votre page" value={publicUrl} />
            ) : (
              <p className="text-ink-muted">La page est fermée : personne ne peut l&apos;ouvrir.</p>
            )}
            {canManagePage ? (
              <form action={setPublicPageAction} className="space-y-4">
                <Check name="enabled" defaultChecked={publicPage.enabled} label="Ouvrir la page au public" />
                <div className="max-w-sm">
                  <Field label="Qui reçoit les demandes ?" htmlFor="owner" hint="Il devient responsable du contact, du bien et de la tâche de rappel.">
                    <Select id="owner" name="owner" defaultValue={publicPage.leadOwnerUserId ?? ctx.user.id}>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>{m.name}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <SubmitButton variant="secondary">Mettre à jour la page</SubmitButton>
              </form>
            ) : (
              <p className="text-xs text-ink-muted">Seuls le gérant et les managers peuvent ouvrir ou fermer cette page.</p>
            )}
          </CardBody>
        </Card>
      </div>

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
