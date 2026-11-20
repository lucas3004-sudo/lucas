import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { requireAgency } from "@/lib/agency/context";
import { canManageTeam } from "@/lib/agency/rules";
import { getAgencySettings } from "@/lib/agency/settings";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/roles";
import { getAuth } from "@/lib/auth/server";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/ui/surface";

export const metadata: Metadata = { title: "Tableau de bord" };

// Feuille de route affichée telle quelle : ce sont des étapes prévues, pas des boutons.
const ROADMAP = [
  { title: "Dossier de bien depuis une adresse", detail: "Ventes comparables DVF, DPE, risques, loyers — chaque chiffre sourcé.", phase: "Phase 4" },
  { title: "Équipe d'agents IA", detail: "Missions, approbations, coûts mesurés dans l'Agent Center.", phase: "Phase 5" },
  { title: "CRM, matching et Investment Studio", detail: "Acquéreurs, rapprochements à l'échelle de l'agence, simulations.", phase: "Phase 6" },
];

export default async function DashboardPage() {
  const ctx = await requireAgency();
  const { user, org, role } = ctx;
  const settings = await getAgencySettings(ctx);
  const full = await getAuth().api.getFullOrganization({ headers: await headers(), query: { organizationId: org.id } });
  const members = full?.members.length ?? 0;
  const pending = full?.invitations.filter((i) => i.status === "pending").length ?? 0;
  const manager = canManageTeam(role);

  const steps = [
    { done: members > 1, label: "Inviter votre équipe", href: "/app/equipe", visible: manager },
    { done: settings.configured, label: "Choisir la visibilité par défaut des contacts et des biens", href: "/app/parametres", visible: manager },
  ].filter((s) => s.visible);

  return (
    <>
      <PageHeader title={`Bonjour ${user.name.split(" ")[0]}`} description={`Espace de l'agence ${org.name}.`} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-[13px] text-ink-muted">Membres de l&apos;agence</p>
            <p className="tabular mt-1 text-3xl font-semibold tracking-tight text-ink">{members}</p>
            {pending > 0 ? <p className="mt-1 text-xs text-ink-muted">{pending} invitation(s) en attente</p> : null}
          </CardBody>
        </Card>
        <Card className="md:col-span-2">
          <CardBody>
            <div className="flex items-center gap-2">
              <p className="text-[13px] text-ink-muted">Votre rôle</p>
              <Badge tone="brand">{ROLE_LABELS[role]}</Badge>
            </div>
            <p className="mt-2 text-sm text-ink">{ROLE_DESCRIPTIONS[role]}</p>
          </CardBody>
        </Card>
      </div>

      {steps.length > 0 ? (
        <Card className="mt-4">
          <CardHeader title="Mise en route" description="Les premières étapes pour préparer l'espace de l'agence." />
          <ul className="divide-y divide-line">
            {steps.map((step) => (
              <li key={step.href}>
                <Link href={step.href} className="flex items-center gap-3 px-5 py-3.5 text-sm hover:bg-surface-muted">
                  <span
                    aria-hidden
                    className={step.done ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-[11px] text-white" : "size-5 shrink-0 rounded-full border-2 border-line-strong"}
                  >
                    {step.done ? "✓" : null}
                  </span>
                  <span className={step.done ? "text-ink-muted line-through" : "text-ink"}>{step.label}</span>
                  <span aria-hidden className="ml-auto text-ink-subtle">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardHeader title="Prochains modules" description="En cours de construction. Ils apparaîtront dans le menu lorsqu'ils seront disponibles et testés." />
        <ul className="divide-y divide-line">
          {ROADMAP.map((item) => (
            <li key={item.title} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{item.title}</p>
                <p className="text-[13px] text-ink-muted">{item.detail}</p>
              </div>
              <Badge>{item.phase}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
