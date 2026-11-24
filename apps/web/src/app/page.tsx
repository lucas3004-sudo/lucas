/**
 * Page d'accueil publique (D-057, refonte D-058) : présentation du produit et des formules,
 * gratuite et sans compte. Une scène d'ouverture pilotée par le défilement (la fenêtre du
 * logiciel s'allume puis se transforme), puis une feuille claire qui glisse par-dessus : vraies
 * captures, fonctions en verre dépoli, tarifs, questions. Aucun chiffre inventé présenté comme
 * réel : la maquette animée porte la mention « Exemple ».
 */
import { METRIC_LABELS, monthlyPrice, PLANS } from "@immopilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { getSession } from "@/lib/agency/context";
import { PAID_PLANS } from "@/lib/billing/stripe";
import { fmt } from "@/lib/format";
import { cn } from "@/ui/cn";
import { LogoMark } from "@/ui/logo";
import { ScrollGallery } from "./_site/gallery";
import { SiteIcon, type SiteIconName } from "./_site/icons";
import { RevealOnScroll } from "./_site/reveal";
import { Story } from "./_site/story";
import "./_site/site.css";

export const metadata: Metadata = {
  title: "ImmoPilot — le logiciel des agences immobilières",
  description: "Carte des biens et bonnes affaires, fiches avec analyse du marché, CRM et rapprochement acquéreurs, agents qui travaillent pour vous. Essai gratuit de 14 jours.",
};

const v = (vars: Record<string, string | number>) => vars as CSSProperties;
const display = "font-display font-semibold tracking-[-0.04em] text-balance";

const FEATURES: { icon: SiteIconName; title: string; text: string }[] = [
  { icon: "map", title: "Carte et bonnes affaires", text: "Vos biens, les ventes réelles autour, la recherche par lieu et par rayon." },
  { icon: "chart", title: "Analyse du marché sourcée", text: "Fourchette, rendement, risques et verdict. Chaque chiffre dit d'où il vient." },
  { icon: "target", title: "Acquéreurs rapprochés", text: "Chaque bien comparé aux recherches de toute l'agence, sans exposer les contacts privés." },
  { icon: "key", title: "Mandats et affaires", text: "Échéances calculées, étapes de l'offre à l'acte, comptes rendus de visite." },
  { icon: "bot", title: "Des agents qui préparent", text: "Ils vérifient et proposent ; rien d'important ne part sans votre accord." },
  { icon: "shield", title: "Sécurité et liberté", text: "Agences isolées, double authentification, export complet de vos données." },
];

const STATS = [
  { value: 14, suffix: "", label: "jours d'essai gratuit" },
  { value: 6, suffix: "", label: "sources de données publiques" },
  { value: 100, suffix: " %", label: "de vos données exportables" },
  { value: 0, suffix: " €", label: "pour commencer, sans carte" },
];

const FAQ = [
  {
    q: "Comment fonctionne l'essai gratuit ?",
    a: "Vous créez votre compte et votre agence, puis vous utilisez ImmoPilot pendant 14 jours, sans carte bancaire. Pour continuer ensuite, vous choisissez une formule ; sans formule, l'accès au logiciel est suspendu mais vos données restent en place.",
  },
  {
    q: "D'où viennent les prix et les ventes affichés ?",
    a: "Des bases publiques de l'État : ventes réelles (DVF, DGFiP), diagnostics énergétiques (ADEME), risques (Géorisques), cartes (IGN), loyers (ANIL), adresses (BAN). Chaque chiffre indique sa source et sa date. Les estimations sont des repères, pas des expertises.",
  },
  {
    q: "Les annonces des portails immobiliers sont-elles affichées ?",
    a: "Non. ImmoPilot affiche vos biens et les ventes réelles publiques ; il ne copie pas les annonces des portails.",
  },
  {
    q: "Combien d'utilisateurs par formule ?",
    a: "Solo et Pro : un utilisateur. Agency : trois utilisateurs inclus, puis 49 € HT par mois et par utilisateur supplémentaire.",
  },
  {
    q: "Puis-je arrêter quand je veux ?",
    a: "Oui. Les formules sont mensuelles et sans engagement : vous gérez ou arrêtez l'abonnement depuis votre espace, à tout moment. L'export complet de vos données reste disponible.",
  },
  {
    q: "Et l'intelligence artificielle ?",
    a: "Les agents d'ImmoPilot travaillent déjà pour vous (échéances, doublons, rapprochements) sans IA générative. L'analyse de chaque annonce rédigée par l'IA arrive prochainement ; elle sera comptée dans les quotas de votre formule.",
  },
];

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.22em] text-s-acc-ink", className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </p>
  );
}

export default async function Home() {
  const session = await getSession();
  const loggedIn = Boolean(session);
  const cta = loggedIn ? { href: "/app", label: "Ouvrir ImmoPilot" } : { href: "/inscription", label: "Démarrer l'essai gratuit" };

  return (
    <div className="site min-h-dvh overflow-x-clip">
      <RevealOnScroll />

      {/* Barre de navigation flottante en verre. */}
      <header className="fixed inset-x-0 top-3 z-40 px-3 sm:top-4">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 rounded-full border border-white/60 bg-white/75 pl-4 pr-2 text-[#1c1411] shadow-[0_10px_40px_-14px_rgb(0_0_0/0.35)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-[#1a1310]/75 dark:text-[#f6eee8]">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <LogoMark className="size-7 text-[#1c1411] dark:text-[#f6eee8]" />
            <span className="text-[15px] font-semibold tracking-tight">ImmoPilot</span>
          </Link>
          <nav aria-label="Sections du site" className="hidden items-center gap-1 md:flex">
            {[
              ["#logiciel", "Le logiciel"],
              ["#fonctions", "Fonctions"],
              ["#tarifs", "Tarifs"],
              ["#questions", "Questions"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-full px-3 py-1.5 text-sm opacity-75 transition-opacity hover:opacity-100">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            {loggedIn ? null : (
              <Link href="/connexion" className="hidden rounded-full px-3 py-2 text-sm opacity-75 hover:opacity-100 sm:inline-block">Se connecter</Link>
            )}
            <Link href={cta.href} className="press inline-flex h-10 items-center rounded-full bg-[#1c1411] px-4 text-sm font-medium text-white hover:bg-[#1c1411]/85 dark:bg-[#f6eee8] dark:text-[#1c1411]">
              {loggedIn ? "Ouvrir ImmoPilot" : "Essai gratuit"}
            </Link>
          </div>
        </div>
      </header>

      <main id="contenu">
        <Story cta={cta} />

        {/* Feuille claire qui glisse par-dessus la scène. */}
        <div className="relative z-10 -mt-[14svh] rounded-t-[36px] bg-s-bg shadow-[0_-30px_60px_-30px_rgb(0_0_0/0.5)] sm:rounded-t-[48px]">
          <section id="logiciel" aria-labelledby="titre-logiciel" className="scroll-mt-24 pt-24 sm:pt-32">
            <div className="mx-auto max-w-3xl px-5 text-center" data-reveal>
              <div className="rise-in"><Eyebrow>Le vrai logiciel</Eyebrow></div>
              <h2 id="titre-logiciel" className={cn(display, "rise-in mt-5 text-4xl leading-[1.04] sm:text-6xl")} style={v({ "--d": "60ms" })}>
                Pas une maquette. <span className="font-serif-italic text-[1.1em] text-s-acc-ink">Vos vrais écrans.</span>
              </h2>
              <p className="rise-in mx-auto mt-5 max-w-xl text-lg text-s-muted" style={v({ "--d": "120ms", "--rise": "10px" })}>
                Ces captures viennent du logiciel, avec les données publiques de l&apos;État : ventes réelles, diagnostics, risques et cartes.
              </p>
            </div>
            <div className="mt-14">
              <ScrollGallery />
            </div>
          </section>

          {/* Fonctions en verre dépoli, sur un fond de lueurs chaudes. */}
          <section
            id="fonctions"
            aria-labelledby="titre-fonctions"
            className="relative scroll-mt-24 px-5 py-28 sm:py-36"
            style={{ background: "radial-gradient(55% 45% at 12% 22%, rgb(226 85 58 / 0.16), transparent), radial-gradient(50% 45% at 88% 78%, rgb(236 150 60 / 0.18), transparent)" }}
          >
            <div className="relative mx-auto max-w-6xl">
              <div className="mx-auto max-w-3xl text-center" data-reveal>
                <div className="rise-in"><Eyebrow>Tout au même endroit</Eyebrow></div>
                <h2 id="titre-fonctions" className={cn(display, "rise-in mt-5 text-4xl leading-[1.04] sm:text-6xl")} style={v({ "--d": "60ms" })}>
                  Simple à prendre en main, <span className="font-serif-italic text-[1.1em] text-s-acc-ink">complet</span> au quotidien.
                </h2>
              </div>
              <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-reveal>
                {FEATURES.map((f, i) => (
                  <article key={f.title} className="tilt-in glass rounded-[28px] p-7 shadow-[0_30px_60px_-40px_rgb(60_30_20/0.5)]" style={v({ "--d": `${i * 55}ms` })}>
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-[#1c1411] text-white dark:bg-white/10">
                      <SiteIcon name={f.icon} className="size-5" />
                    </span>
                    <h3 className="mt-6 text-lg font-semibold tracking-tight">{f.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-s-muted">{f.text}</p>
                  </article>
                ))}
              </div>
              <dl className="mt-16 grid grid-cols-2 gap-y-10 lg:grid-cols-4" data-reveal>
                {STATS.map((s, i) => (
                  <div key={s.label} className="rise-in text-center" style={v({ "--d": `${i * 70}ms` })}>
                    <dt className="sr-only">{s.label}</dt>
                    <dd>
                      <span className="font-display text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">
                        <span data-count={s.value}>{s.value}</span>
                        {s.suffix}
                      </span>
                      <span aria-hidden="true" className="mt-2 block text-sm text-s-muted">{s.label}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {/* Tarifs. */}
          <section id="tarifs" aria-labelledby="titre-tarifs" className="scroll-mt-24 px-5 py-28 sm:py-36" data-reveal>
            <div className="mx-auto max-w-3xl text-center">
              <div className="rise-in"><Eyebrow>Tarifs</Eyebrow></div>
              <h2 id="titre-tarifs" className={cn(display, "rise-in mt-5 text-4xl leading-[1.04] sm:text-6xl")} style={v({ "--d": "60ms" })}>Des tarifs simples.</h2>
              <p className="rise-in mt-5 text-lg text-s-muted" style={v({ "--d": "120ms", "--rise": "10px" })}>
                Prix hors taxes, par mois, sans engagement. 14 jours d&apos;essai gratuit, sans carte bancaire.
              </p>
              <p className="rise-in mt-3 text-sm text-s-muted" style={v({ "--d": "160ms", "--rise": "10px" })}>
                Besoin de plus d&apos;IA ? Au-delà du forfait : 2 € les 100 échanges, 0,20 € l&apos;annonce, avec un plafond mensuel que vous choisissez.
              </p>
            </div>
            <div className="mx-auto mt-14 grid max-w-6xl gap-4 md:grid-cols-2 lg:grid-cols-4">
              {PAID_PLANS.map((id, i) => {
                const plan = PLANS[id];
                const featured = id === "agency";
                return (
                  <div
                    key={id}
                    className={cn(
                      "tilt-in relative flex flex-col overflow-hidden rounded-[28px] p-7",
                      featured ? "bg-s-night text-[#f6eee8] shadow-[0_40px_80px_-30px_rgb(var(--acc-rgb)/0.55)] ring-1 ring-white/10" : "glass shadow-[0_30px_60px_-45px_rgb(60_30_20/0.5)]",
                    )}
                    style={v({ "--d": `${i * 70}ms` })}
                  >
                    {featured ? <div aria-hidden="true" className="glow pointer-events-none -right-24 -top-24 size-72 opacity-70" /> : null}
                    <div className="relative flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold">{plan.name}</h3>
                      {featured ? <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium">Pour une équipe</span> : null}
                    </div>
                    <p className="relative mt-5">
                      <span className="font-display text-5xl font-semibold tracking-[-0.04em]">{fmt.euros(monthlyPrice(plan) ?? 0)}</span>
                      <span className={cn("text-sm", featured ? "text-white/70" : "text-s-muted")}> HT / mois</span>
                    </p>
                    <p className={cn("relative mt-3 min-h-10 text-sm", featured ? "text-white/75" : "text-s-muted")}>{plan.description}</p>
                    <ul className={cn("relative mt-6 flex-1 space-y-2.5 border-t pt-6 text-sm", featured ? "border-white/10" : "border-s-line")}>
                      {(Object.keys(plan.quotas) as (keyof typeof plan.quotas)[]).map((m) => {
                        const q = plan.quotas[m];
                        const ai = m === "copilot" || m === "annonces_ia";
                        return (
                          <li key={m} className="flex items-center justify-between gap-2">
                            <span className={featured ? "text-white/75" : "text-s-muted"}>
                              {METRIC_LABELS[m].replace(" ce mois-ci", "")}
                              {ai && q ? <span className="ml-1.5 rounded-full border border-current/25 px-1.5 text-[10px] uppercase tracking-wide">bientôt</span> : null}
                            </span>
                            <span className="font-medium">{q === null ? "Illimité" : q === 0 ? "—" : fmt.number(q)}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <Link
                      href={loggedIn ? "/abonnement" : "/inscription"}
                      className={cn(
                        "press relative mt-8 inline-flex h-12 w-full items-center justify-center rounded-full text-sm font-medium",
                        featured ? "bg-white text-[#1c1411] hover:bg-white/90" : "bg-[#1c1411] text-white hover:bg-[#1c1411]/85 dark:bg-white dark:text-[#1c1411]",
                      )}
                    >
                      {loggedIn ? `Choisir ${plan.name}` : "Commencer l'essai"}
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Questions fréquentes. */}
          <section id="questions" aria-labelledby="titre-questions" className="scroll-mt-24 px-5 pb-28 sm:pb-36">
            <div className="mx-auto max-w-3xl">
              <div className="text-center" data-reveal>
                <h2 id="titre-questions" className={cn(display, "rise-in text-4xl leading-[1.04] sm:text-5xl")}>Questions fréquentes</h2>
              </div>
              <div className="site-faq glass mt-12 divide-y divide-s-line rounded-[28px] px-6 sm:px-8">
                {FAQ.map((item) => (
                  <details key={item.q}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-6 text-left text-base font-medium">
                      {item.q}
                      <span className="faq-plus flex size-8 shrink-0 items-center justify-center rounded-full border border-s-line">
                        <SiteIcon name="plus" className="size-3.5" strokeWidth={2} />
                      </span>
                    </summary>
                    <p className="pb-6 pr-10 text-[15px] leading-relaxed text-s-muted">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* Dernier appel : la nuit revient, le nom s'allume. */}
          <section aria-labelledby="titre-fin" className="px-2 pb-2 sm:px-3 sm:pb-3">
            <div className="relative overflow-hidden rounded-[36px] bg-s-night px-5 py-28 text-center text-[#f6eee8] sm:rounded-[48px] sm:py-36" data-reveal>
              <div aria-hidden="true" className="glow glow-a" />
              <div aria-hidden="true" className="glow glow-b" />
              <div className="relative">
                <div className="reveal-circle mx-auto flex size-20 items-center justify-center rounded-[26px] bg-white/[0.08] ring-1 ring-white/15">
                  <span style={{ ["--canvas" as string]: "#0f0a08" }}>
                    <LogoMark className="size-11 text-[#f6eee8]" />
                  </span>
                </div>
                <h2 id="titre-fin" className={cn(display, "rise-in mx-auto mt-8 max-w-4xl text-4xl leading-[1.04] sm:text-7xl")} style={v({ "--d": "250ms" })}>
                  Votre agence, <span className="font-serif-italic text-[1.1em] text-[#ffb79e]">pilotée</span> depuis un seul écran.
                </h2>
                <p className="rise-in mx-auto mt-6 max-w-xl text-lg text-white/75" style={v({ "--d": "350ms", "--rise": "10px" })}>
                  Créez votre agence en quelques minutes et essayez tout, gratuitement, pendant 14 jours.
                </p>
                <div className="rise-in mt-10 flex flex-wrap justify-center gap-3" style={v({ "--d": "420ms", "--rise": "8px" })}>
                  <Link href={cta.href} className="press inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-medium text-[#1c1411] shadow-[0_10px_40px_-10px_rgb(var(--acc-rgb)/0.8)] hover:bg-white/90">
                    {loggedIn ? "Ouvrir ImmoPilot" : "Commencer l'essai gratuit"}
                    <SiteIcon name="arrow" className="arrow size-4" strokeWidth={2} />
                  </Link>
                  <a href="#tarifs" className="press inline-flex h-12 items-center rounded-full border border-white/20 bg-white/[0.06] px-6 text-[15px] font-medium hover:bg-white/[0.12]">
                    Voir les tarifs
                  </a>
                </div>
              </div>
            </div>
          </section>

          <footer className="px-5 py-12 text-sm text-s-muted">
            <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="max-w-md space-y-3">
                <span className="inline-flex items-center gap-2.5 text-s-ink">
                  <LogoMark className="size-7" />
                  <span className="text-[15px] font-semibold tracking-tight">ImmoPilot</span>
                </span>
                <p>Le logiciel des agences immobilières indépendantes : carte, analyse du marché, clients, mandats et agents.</p>
                <p>Données : DVF (DGFiP), ADEME, Géorisques, IGN, ANIL, BAN — sous licence ouverte.</p>
              </div>
              <nav aria-label="Liens du pied de page" className="flex flex-wrap gap-x-6 gap-y-2 md:flex-col">
                <a href="#logiciel" className="hover:text-s-ink">Le logiciel</a>
                <a href="#tarifs" className="hover:text-s-ink">Tarifs</a>
                <a href="#questions" className="hover:text-s-ink">Questions fréquentes</a>
                <Link href="/connexion" className="hover:text-s-ink">Se connecter</Link>
              </nav>
            </div>
            <p className="mx-auto mt-8 max-w-6xl">© {new Date().getFullYear()} ImmoPilot</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
