import type { Metadata } from "next";
import { requireAgency, getSession } from "@/lib/agency/context";
import { Badge, Card, CardHeader, PageHeader } from "@/ui/surface";
import { TwoFactorSettings } from "./two-factor-settings";

export const metadata: Metadata = { title: "Sécurité du compte" };

export default async function SecurityPage() {
  const ctx = await requireAgency();
  const session = await getSession();
  const enabled = Boolean((session?.user as { twoFactorEnabled?: boolean | null } | undefined)?.twoFactorEnabled);
  return (
    <>
      <PageHeader title="Sécurité du compte" description={`Compte : ${ctx.user.email}`} />
      <Card className="max-w-2xl">
        <CardHeader
          title="Double authentification"
          description="En plus du mot de passe, un code à 6 chiffres donné par une application (Google Authenticator, Microsoft Authenticator, 1Password…) est demandé à chaque connexion."
          action={<Badge tone={enabled ? "success" : "warning"}>{enabled ? "Activée" : "Désactivée"}</Badge>}
        />
        <TwoFactorSettings enabled={enabled} recommended={ctx.role === "gerant" || ctx.role === "manager"} />
      </Card>
    </>
  );
}
