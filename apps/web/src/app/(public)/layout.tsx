import { Logo, LogoMark } from "@/ui/logo";

const POINTS = [
  "Des dossiers de biens fondés sur les données officielles (DVF, DPE, Géorisques), chaque chiffre sourcé et daté.",
  "Une équipe d'agents IA qui prépare, rapproche et rédige — sans jamais agir à l'extérieur sans votre validation.",
  "Les données de chaque agence isolées des autres, au cœur même de la base de données.",
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-[#0f2548] px-12 py-10 text-white lg:flex lg:flex-col">
        <span className="inline-flex items-center gap-2.5">
          <LogoMark className="size-7 text-white/15" />
          <span className="text-[15px] font-semibold tracking-tight">
            ImmoPilot <span className="font-medium text-white/60">AI</span>
          </span>
        </span>
        <div className="my-auto max-w-md">
          <p className="text-[28px] font-semibold leading-tight tracking-tight">
            L&apos;équipe d&apos;assistants IA de votre agence immobilière.
          </p>
          <ul className="mt-8 space-y-4">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3 text-[15px] leading-relaxed text-white/80">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-white/60" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/50">Version de développement — fonctionnalités en cours de construction.</p>
        <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full border border-white/10" />
        <div aria-hidden className="pointer-events-none absolute -right-8 -bottom-8 size-64 rounded-full border border-white/10" />
      </aside>
      <main className="flex flex-col px-6 py-8 sm:px-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto my-auto w-full max-w-sm py-10">{children}</div>
      </main>
    </div>
  );
}
