"use client";
/** Bouton d'aide flottant (D-063) : ouvre l'assistant depuis n'importe quelle page du logiciel. */
import Link from "next/link";
import { usePathname } from "next/navigation";

export function HelpButton() {
  const pathname = usePathname();
  if (pathname.startsWith("/app/assistant")) return null;
  return (
    <Link
      href="/app/assistant"
      className="pop-in fixed bottom-5 right-5 z-30 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-canvas shadow-[var(--shadow-pop)] transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.97] print:hidden"
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      </svg>
      Besoin d&apos;aide ?
    </Link>
  );
}
