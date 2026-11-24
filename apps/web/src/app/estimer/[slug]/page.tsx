import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicEstimationPage } from "@/lib/public/estimation";
import { LogoMark } from "@/ui/logo";
import { EstimationFlow } from "./flow";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await publicEstimationPage((await params).slug);
  return { title: page ? `Estimez votre bien avec ${page.name}` : "Page introuvable", robots: { index: false } };
}

/** Page publique d'une agence (D-067) : estimation indicative et demande de rappel, sans compte. */
export default async function PublicEstimationPage({ params }: Props) {
  const { slug } = await params;
  const page = await publicEstimationPage(slug);
  if (!page) notFound();
  return (
    <main className="page-in mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-10 sm:py-16">
      <p className="text-sm font-medium text-brand-text">{page.name}</p>
      <h1 className="mt-2 font-display text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink sm:text-[40px]">
        Estimez votre bien <span className="font-serif text-[1.1em] italic text-brand-text">gratuitement.</span>
      </h1>
      <p className="mt-3 text-[15px] text-ink-muted">
        Une première fourchette tout de suite, calculée sur les vraies ventes de votre quartier. Puis, si vous le souhaitez, un conseiller de {page.name} vous recontacte.
      </p>
      <div className="mt-8">
        <EstimationFlow slug={slug} agency={page.name} />
      </div>
      <p className="mt-auto flex items-center gap-2 pt-12 text-xs text-ink-subtle">
        <LogoMark className="size-4" /> Page proposée par {page.name} avec ImmoPilot.
      </p>
    </main>
  );
}
