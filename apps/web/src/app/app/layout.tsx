import { signOutAction } from "@/lib/agency/actions";
import { requireAgency } from "@/lib/agency/context";
import { canReadAuditLog } from "@/lib/agency/rules";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { Logo } from "@/ui/logo";
import { Nav, type NavItem } from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, org, role } = await requireAgency();

  // Seuls les modules réellement construits apparaissent (aucun lien vers une page vide).
  const items: NavItem[] = [
    { href: "/app", label: "Tableau de bord", icon: "home" },
    { href: "/app/contacts", label: "Contacts", icon: "contacts" },
    { href: "/app/proprietes", label: "Biens de l'agence", icon: "key" },
    { href: "/app/biens", label: "Dossiers de biens", icon: "building" },
    { href: "/app/taches", label: "Tâches", icon: "check" },
    { href: "/app/equipe", label: "Équipe", icon: "team" },
    { href: "/app/parametres", label: "Paramètres", icon: "settings" },
    ...(canReadAuditLog(role) ? [{ href: "/app/journal", label: "Journal d'audit", icon: "journal" as const }] : []),
  ];

  const account = (
    <div className="border-t border-line pt-4">
      <p className="truncate text-sm font-medium text-ink">{user.name}</p>
      <p className="truncate text-xs text-ink-muted">{user.email}</p>
      <form action={signOutAction} className="mt-3">
        <button type="submit" className="text-xs font-medium text-ink-muted hover:text-ink">
          Se déconnecter
        </button>
      </form>
    </div>
  );

  const agency = (
    <div className="rounded-[var(--radius-control)] border border-line bg-surface-muted px-3 py-2.5">
      <p className="truncate text-sm font-medium text-ink" title={org.name}>
        {org.name}
      </p>
      <p className="text-xs text-ink-muted">{ROLE_LABELS[role]}</p>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)] print:block">
      <aside className="hidden print:!hidden border-r border-line bg-surface lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:sticky lg:top-0 lg:px-4 lg:py-5">
        <div className="px-1">
          <Logo />
        </div>
        {agency}
        <div className="flex-1">
          <Nav items={items} />
        </div>
        {account}
      </aside>

      <details className="group border-b border-line bg-surface lg:hidden print:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
          <Logo />
          <span className="text-sm font-medium text-ink-muted group-open:hidden">Menu</span>
          <span className="hidden text-sm font-medium text-ink-muted group-open:inline">Fermer</span>
        </summary>
        <div className="space-y-4 px-4 pb-4">
          {agency}
          <Nav items={items} />
          {account}
        </div>
      </details>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
