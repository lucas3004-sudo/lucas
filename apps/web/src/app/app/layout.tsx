import { signOutAction } from "@/lib/agency/actions";
import Link from "next/link";
import { getSession, requireAgency } from "@/lib/agency/context";
import { schemaStatus } from "@/lib/server/schema-check";
import { canReadAuditLog } from "@/lib/agency/rules";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { Logo } from "@/ui/logo";
import { agencyAccess } from "@/lib/billing/subscription";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { runDailyAgents } from "@/lib/agents/run";
import { HelpButton } from "./help-button";
import { Nav, type NavSection } from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Code déployé sans sa migration : on ne sert pas l'application sur une base en retard.
  const schema = await schemaStatus();
  if (!schema.ok) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 text-center">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Mise à jour en cours</h1>
        <p className="mt-2 text-sm text-ink-muted">
          La base de données n&apos;est pas encore à jour ({schema.missing.length} étape(s) en attente). Vos données ne sont pas affectées.
          Réessayez dans quelques minutes.
        </p>
      </main>
    );
  }
  const ctx = await requireAgency();
  const { user, org, role } = ctx;
  // Après l'essai de 14 jours, il faut un abonnement payé (D-057). Les données restent conservées.
  const { access } = await agencyAccess(ctx);
  if (!access.allowed) redirect("/abonnement");
  // Passage automatique des agents (D-064) : une fois par jour, après l'envoi de la page.
  after(() => runDailyAgents(ctx).catch((error) => console.error("Passage automatique des agents impossible", error)));
  const session = await getSession();
  const twoFactorOn = Boolean((session?.user as { twoFactorEnabled?: boolean | null } | undefined)?.twoFactorEnabled);
  const remindTwoFactor = (role === "gerant" || role === "manager") && !twoFactorOn;

  // Seuls les modules réellement construits apparaissent (aucun lien vers une page vide).
  // Menu simplifié (D-060) : 7 entrées pour le travail de tous les jours, puis outils et agence.
  const sections: NavSection[] = [
    {
      items: [
        { href: "/app", label: "Accueil", icon: "home" },
        { href: "/app/proprietes", label: "Biens", icon: "key" },
        { href: "/app/prospection", label: "Prospection", icon: "target" },
        { href: "/app/carte", label: "Carte", icon: "map" },
        { href: "/app/contacts", label: "Contacts", icon: "contacts" },
        { href: "/app/agenda", label: "Agenda", icon: "calendar" },
        { href: "/app/affaires", label: "Affaires", icon: "deal" },
        ...(role !== "lecture" ? [{ href: "/app/agents", label: "Agents", icon: "bot" as const }] : []),
      ],
    },
    {
      label: "Outils",
      items: [
        { href: "/app/assistant", label: "Assistant IA", icon: "sparkle" },
        { href: "/app/biens", label: "Estimations", icon: "building" },
        { href: "/app/investissement", label: "Investissement", icon: "chart" },
        { href: "/app/taches", label: "Tâches", icon: "check" },
        { href: "/app/qualite", label: "Qualité des données", icon: "shield" },
      ],
    },
    {
      label: "Agence",
      items: [
        { href: "/app/equipe", label: "Équipe", icon: "team" },
        { href: "/app/formule", label: "Formule", icon: "plan" },
        { href: "/app/parametres", label: "Paramètres", icon: "settings" },
        ...(canReadAuditLog(role)
          ? [
              { href: "/app/pilotage", label: "Pilotage", icon: "gauge" as const },
              { href: "/app/journal", label: "Journal d'audit", icon: "journal" as const },
            ]
          : []),
      ],
    },
  ];

  const account = (
    <div className="border-t border-line pt-4">
      <p className="truncate text-sm font-medium text-ink">{user.name}</p>
      <p className="truncate text-xs text-ink-muted">{user.email}</p>
      <Link href="/app/securite" className="mt-3 block text-xs font-medium text-ink-muted hover:text-ink">
        Sécurité du compte{twoFactorOn ? "" : " (double authentification désactivée)"}
      </Link>
      <form action={signOutAction} className="mt-2">
        <button type="submit" className="text-xs font-medium text-ink-muted hover:text-ink">
          Se déconnecter
        </button>
      </form>
    </div>
  );

  const agency = (
    <div className="rounded-2xl border border-line bg-surface-muted px-3.5 py-3">
      <p className="truncate text-sm font-medium text-ink" title={org.name}>
        {org.name}
      </p>
      <p className="text-xs text-ink-muted">{ROLE_LABELS[role]}</p>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)] print:block">
      {/* Lien d'évitement (WCAG 2.4.1) : premier élément atteint au clavier, visible seulement quand il a le focus. */}
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-[var(--shadow-card)] print:hidden"
      >
        Aller au contenu
      </a>
      {/* Barre latérale « nuit », comme le haut de la page d'accueil (D-059). */}
      <aside className="night relative hidden overflow-hidden print:!hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:px-4 lg:py-5">
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-[radial-gradient(closest-side,rgb(226_85_58/0.35),transparent)]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-24 size-80 rounded-full bg-[radial-gradient(closest-side,rgb(236_150_60/0.18),transparent)]" />
        <div className="relative px-1">
          <Logo />
        </div>
        <div className="relative">{agency}</div>
        <div className="relative -mx-1 flex-1 overflow-y-auto px-1">
          <Nav sections={sections} />
        </div>
        <div className="relative">{account}</div>
      </aside>

      <details className="night menu-details group sticky top-0 z-30 lg:hidden print:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
          <Logo />
          <span className="text-sm font-medium text-ink-muted group-open:hidden">Menu</span>
          <span className="hidden text-sm font-medium text-ink-muted group-open:inline">Fermer</span>
        </summary>
        {/* Le menu ouvert tient dans l'écran et défile à l'intérieur (sinon son bas serait inaccessible). */}
        <div className="max-h-[calc(100dvh-4rem)] space-y-4 overflow-y-auto overscroll-contain px-4 pb-4">
          {agency}
          <Nav sections={sections} />
          {account}
        </div>
      </details>

      <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-6 focus:outline-none sm:px-8 sm:py-10">
        {access.reason === "essai" && role === "gerant" ? (
          <div role="status" className="pop-in mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-brand-text print:hidden">
            <span>Essai gratuit : {access.daysLeft} jour(s) restant(s).</span>
            <Link href="/abonnement" className="font-medium underline">Choisir une formule</Link>
          </div>
        ) : null}
        {access.reason === "paiement_en_retard" && role === "gerant" ? (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] bg-warning-soft px-3.5 py-2.5 text-sm text-warning print:hidden">
            <span>Le dernier paiement a échoué : accès maintenu encore {access.daysLeft} jour(s).</span>
            <Link href="/abonnement" className="font-medium underline">Mettre à jour la carte</Link>
          </div>
        ) : null}
        {remindTwoFactor ? (
          <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] bg-warning-soft px-3.5 py-2.5 text-sm text-warning print:hidden">
            <span>Votre rôle donne accès à toutes les données de l&apos;agence : activez la double authentification.</span>
            <Link href="/app/securite" className="font-medium underline">Activer</Link>
          </div>
        ) : null}
        {children}
      </main>
      <HelpButton />
    </div>
  );
}
