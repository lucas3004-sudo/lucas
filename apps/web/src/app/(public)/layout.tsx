import Link from "next/link";
import { Logo, LogoMark } from "@/ui/logo";
import "../_site/site.css";

const POINTS = [
  "Des dossiers de biens fondés sur les données officielles (DVF, DPE, Géorisques), chaque chiffre sourcé et daté.",
  "Des agents qui vérifient, rapprochent et préparent, sans jamais agir à l'extérieur sans votre validation.",
  "Les données de chaque agence isolées des autres, au cœur même de la base de données.",
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="site relative hidden overflow-hidden px-12 py-10 text-[#f6eee8] lg:flex lg:flex-col" style={{ background: "var(--s-night)", color: "#f6eee8" }}>
        <div aria-hidden="true" className="glow glow-a" />
        <div aria-hidden="true" className="glow glow-b" />
        <Link href="/" className="relative inline-flex items-center gap-2.5 self-start">
          <span style={{ ["--canvas" as string]: "#0f0a08" }}>
            <LogoMark className="size-7 text-[#f6eee8]" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">ImmoPilot</span>
        </Link>
        <div className="relative my-auto max-w-md">
          <p className="font-display text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.04em]">
            Toute votre agence, <span className="font-serif-italic text-[1.12em] text-[#ffb79e]">dans un seul outil.</span>
          </p>
          <ul className="mt-10 space-y-4">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3 text-[15px] leading-relaxed text-white/80">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-[#ffb79e]" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/65">14 jours d&apos;essai gratuit, sans carte bancaire, sans engagement.</p>
      </aside>
      <main className="flex flex-col px-6 py-8 sm:px-10">
        <div className="lg:hidden">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <div className="page-in mx-auto my-auto w-full max-w-sm py-10">{children}</div>
      </main>
    </div>
  );
}
