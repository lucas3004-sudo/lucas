"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/ui/cn";

const ICONS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  building: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3",
  team: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.6a3 3 0 0 1 0 5.8",
  settings: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4.5v5M8 14.5v5",
  journal: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7",
  contacts: "M5 4h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5zM5 4v17M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M8.5 17a3.5 3.5 0 0 1 7 0M21 8v2M21 13v2",
  key: "M14.5 9.5a4 4 0 1 0-3.9 3.1L3 20v1h3v-2h2v-2h2l2.3-2.3A4 4 0 0 0 14.5 9.5M16 7.5h.01",
  gauge: "M4 18a8 8 0 1 1 16 0M12 18l4-6M4 18h16",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5",
  deal: "M3 7h18v12H3zM8 7V5h8v2M3 12h18",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5",
  bot: "M12 3v3M7 8h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3zM9 13h.01M15 13h.01M9.5 17h5",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  check: "M4 6h16v14H4zM8 3v5M16 3v5M8.5 13.5l2.5 2.5 4.5-5",
  plan: "M3 6h18v12H3zM3 10h18M7 15h4",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M12 12h.01",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
} as const;

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };
export type NavSection = { label?: string; items: NavItem[] };

/** Menu en sections : l'essentiel d'abord, puis les outils et la gestion de l'agence (D-060). */
export function Nav({ sections }: { sections: NavSection[] }) {
  return (
    <nav aria-label="Navigation principale" className="space-y-5">
      {sections.map((section, i) => (
        <div key={section.label ?? i} className="space-y-0.5">
          {section.label ? <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-subtle">{section.label}</p> : null}
          <NavLinks items={section.items} />
        </div>
      ))}
    </nav>
  );
}

function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-[background-color,color,transform] duration-200 active:scale-[0.98]",
              active ? "bg-white/[0.09] font-medium text-ink shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]" : "text-ink-muted hover:bg-white/[0.05] hover:text-ink",
            )}
          >
            <svg viewBox="0 0 24 24" className={cn("size-[18px] shrink-0 transition-colors", active ? "text-brand-text" : "")} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={ICONS[item.icon]} />
            </svg>
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
