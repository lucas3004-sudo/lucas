import Link from "next/link";
import { buttonClass } from "@/ui/button";

/** Page introuvable — aussi affichée pour un contenu qui existe mais que l'on n'a pas le droit de voir. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-[22px] font-semibold tracking-tight text-ink">Page introuvable</h1>
      <p className="mt-2 text-sm text-ink-muted">Cette page n&apos;existe pas ou vous n&apos;avez pas accès à son contenu.</p>
      <Link href="/app" className={buttonClass("secondary", "md", "mt-6")}>
        Retour au tableau de bord
      </Link>
    </main>
  );
}
