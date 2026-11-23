/**
 * Page d'accueil publique (D-057) : présentation du produit et des formules, gratuite et sans
 * compte. Le logiciel lui-même demande un compte, puis un abonnement après 14 jours d'essai.
 */
import { METRIC_LABELS, monthlyPrice, PLANS } from "@immopilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/agency/context";
import { PAID_PLANS } from "@/lib/billing/stripe";
import { fmt } from "@/lib/format";
import { buttonClass } from "@/ui/button";
import { Logo } from "@/ui/logo";

export const metadata: Metadata = {
  title: "ImmoPilot — le logiciel des agences immobilières",
  description: "Carte des biens et bonnes affaires, fiches avec analyse du marché, CRM et rapprochement acquéreurs, agents qui travaillent pour vous. Essai gratuit de 14 jours.",
};

const FEATURES = [
  { title: "Carte des biens et bonnes affaires", text: "Tous vos biens sur une carte claire, filtrés selon vos critères (lieu, rayon, prix, surface, DPE…), avec les ventes réelles autour et les biens affichés sous le prix du marché." },
  { title: "Fiche du bien et analyse du marché", text: "Photos, description, caractéristiques, puis la fourchette de prix tirée des ventes réelles, le rendement locatif, les risques et un verdict clair." },
  { title: "Acquéreurs rapprochés automatiquement", text: "Chaque nouveau bien est comparé aux recherches de toute l'agence ; le collègue concerné est prévenu, sans jamais exposer les contacts privés." },
  { title: "Suivi des affaires et des mandats", text: "De l'offre à l'acte : échéances calculées, pièces par étape, rappels avant la fin des mandats, comptes rendus de visite prêts à envoyer au vendeur." },
  { title: "Des agents qui travaillent pour vous", text: "Qualité des données, échéances, mandats, doublons : des agents vérifient et préparent, et rien d'important ne se fait sans votre accord." },
  { title: "Sécurité et données officielles", text: "Données publiques de l'État (DVF, DPE, Géorisques, IGN), agences isolées les unes des autres, double authentification, export complet à tout moment." },
];

export default async function Home() {
  const session = await getSession();
  const loggedIn = Boolean(session);
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-8">
          <Logo />
          <nav aria-label="Navigation du site" className="flex items-center gap-2">
            <a href="#formules" className="hidden px-3 text-sm text-ink-muted hover:text-ink sm:inline">Formules</a>
            {loggedIn ? (
              <Link href="/app" className={buttonClass("primary", "sm")}>Ouvrir ImmoPilot</Link>
            ) : (
              <>
                <Link href="/connexion" className={buttonClass("ghost", "sm")}>Se connecter</Link>
                <Link href="/inscription" className={buttonClass("primary", "sm")}>Essai gratuit</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="contenu">
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-16 text-center sm:px-8">
          <p className="text-sm font-medium text-brand-text">Pour les agences immobilières indépendantes</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Trouvez les bonnes affaires, suivez vos mandats, servez mieux vos clients.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-muted">
            ImmoPilot réunit la carte de vos biens, l&apos;analyse du marché avec les ventes réelles, votre fichier clients et des agents qui
            travaillent pour vous. Dans le navigateur, sans installation.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={loggedIn ? "/app" : "/inscription"} className={buttonClass("primary", "md")}>
              {loggedIn ? "Ouvrir ImmoPilot" : "Essayer gratuitement 14 jours"}
            </Link>
            <a href="#formules" className={buttonClass("secondary", "md")}>Voir les formules</a>
          </div>
          <p className="mt-3 text-xs text-ink-muted">Sans engagement. La carte bancaire n&apos;est demandée qu&apos;au choix d&apos;une formule.</p>
          <div className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-[var(--radius-card)] border border-line shadow-[var(--shadow-card)]">
            <img src="/accueil/carte.jpg" alt="Carte des biens d'ImmoPilot : biens de l'agence avec leur prix, ventes réelles autour et liste filtrée à côté" className="w-full" width={1440} height={1000} />
          </div>
        </section>

        <section aria-labelledby="fonctions" className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
          <h2 id="fonctions" className="text-center text-3xl font-semibold tracking-tight text-ink">Tout ce qu&apos;il faut à une agence, au même endroit</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
                <h3 className="text-base font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="fiche" className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-8 lg:grid-cols-2">
          <div>
            <h2 id="fiche" className="text-3xl font-semibold tracking-tight text-ink">Chaque bien, analysé avec les vraies ventes</h2>
            <p className="mt-4 text-ink-muted">
              La fiche du bien compare le prix affiché aux ventes réelles autour (base DVF de l&apos;État), estime le loyer et le rendement,
              liste les risques officiels et conclut : bonne affaire, prix cohérent ou prix élevé. Chaque chiffre indique sa source.
            </p>
          </div>
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-line shadow-[var(--shadow-card)]">
            <img src="/accueil/fiche.jpg" alt="Fiche d'un bien avec son analyse du marché : fourchette de prix, médiane de la commune, rendement locatif et risques" className="w-full" width={1440} height={1060} loading="lazy" />
          </div>
        </section>

        <section id="formules" aria-labelledby="titre-formules" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-8">
          <h2 id="titre-formules" className="text-center text-3xl font-semibold tracking-tight text-ink">Des formules simples</h2>
          <p className="mt-2 text-center text-ink-muted">Prix hors taxes, par mois, sans engagement. 14 jours d&apos;essai gratuit.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PAID_PLANS.map((id) => {
              const plan = PLANS[id];
              return (
                <div key={id} className={`flex flex-col rounded-[var(--radius-card)] border bg-surface p-6 ${id === "agency" ? "border-brand" : "border-line"}`}>
                  <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
                  <p className="mt-2">
                    <span className="text-3xl font-semibold tracking-tight text-ink">{fmt.euros(monthlyPrice(plan) ?? 0)}</span>
                    <span className="text-sm text-ink-muted"> HT / mois</span>
                  </p>
                  <p className="mt-2 text-sm text-ink-muted">{plan.description}</p>
                  <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                    {(Object.keys(plan.quotas) as (keyof typeof plan.quotas)[]).map((m) => (
                      <li key={m} className="flex justify-between gap-2">
                        <span className="text-ink-muted">{METRIC_LABELS[m].replace(" ce mois-ci", "")}</span>
                        <span className="font-medium text-ink">{plan.quotas[m] === null ? "Illimité" : plan.quotas[m] === 0 ? "—" : fmt.number(plan.quotas[m]!)}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={loggedIn ? "/abonnement" : "/inscription"} className={`${buttonClass(id === "agency" ? "primary" : "secondary", "md")} mt-6 w-full`}>
                    {loggedIn ? "Choisir" : "Commencer l'essai"}
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-ink-muted sm:px-8">
          <span>© {new Date().getFullYear()} ImmoPilot</span>
          <span>Données : DVF (DGFiP), ADEME, Géorisques, IGN, ANIL — sous licence ouverte.</span>
        </div>
      </footer>
    </div>
  );
}
