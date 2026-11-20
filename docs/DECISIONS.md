# Journal des décisions — ImmoPilot AI

Chaque décision importante suit le cycle prévu (voir `docs/phase-0-audit.md`, section 6.4) :
contexte, décision, objections du Devil's Advocate, réponse motivée, conditions de révision.

Jusqu'à ce que le système d'agents existe (phase 7), ce cycle est appliqué à la main par Claude
(rôle CTO). Les décisions qui engagent de l'argent, des comptes externes ou des données sensibles
restent soumises à l'accord du fondateur.

Statuts possibles : **Acceptée**, **Modifiée**, **Reportée**, **Refusée**, **Expérimentation**,
**En attente du fondateur**.

---

## D-001 — Monolithe modulaire TypeScript + PostgreSQL
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Contexte** : le projet part de zéro ; l'équipe est réduite (un fondateur non développeur, avec Claude).
- **Décision** : un monorepo pnpm/Turborepo, Next.js (interface et API), un worker Node séparé, PostgreSQL 16 + PostGIS, Drizzle. Le détail des choix figure en section 5.3 de l'audit.
- **Objections du Devil's Advocate**
  1. Next.js mélange l'interface et l'API, ce qui risque de compliquer une API publique plus tard.
  2. Dépendre d'un seul langage limite l'accès aux bibliothèques data et ML de Python.
- **Réponse**
  1. L'API est versionnée (`/api/v1`), validée par zod et documentable en OpenAPI. On pourra l'extraire dans un service dédié si l'usage le justifie.
  2. Les calculs prévus (statistiques, scores, géographie) se font très bien en SQL/PostGIS et en TypeScript. Un service Python reste possible pour un modèle statistique d'estimation, sans remettre en cause le reste.
- **Révision si** : plus de 3 développeurs travaillent en parallèle, ou le trafic de l'API publique dépasse celui de l'application.

## D-002 — Aucun scraping de portails immobiliers
- **Date** : 2026-11-20 · **Statut** : Acceptée, **règle permanente**
- **Contexte** : les portails sont protégés par le droit *sui generis* des bases de données (CA Paris, 2 février 2021 ; Cass. 1re civ., 5 octobre 2022, n° 21-16.307).
- **Décision** : les annonces proviennent uniquement de l'agence elle-même, d'imports, de saisies par l'utilisateur ou de fournisseurs sous licence contractuelle vérifiée.
- **Objection du Devil's Advocate** : sans annonces du marché, l'Opportunity Finder perd l'essentiel de sa valeur face à Yanport ou PriceHubble.
- **Réponse** : c'est exact, et assumé. Le risque juridique et le risque de réputation auprès d'une clientèle de professionnels sont rédhibitoires. La valeur à court terme se déplace vers l'analyse (DVF, DPE, risques) et le matching sur les biens de l'agence. Un agrégateur sous licence sera évalué (décision n° 2 du fondateur).
- **Révision** : jamais pour le scraping. Le choix d'un fournisseur sous licence se fera en phase 1 et en phase 6.

## D-003 — Agents : moteur unique, registre déclaratif, trois modes d'exécution
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Contexte** : le cahier des charges liste plus de 130 agents. Beaucoup de leurs tâches sont déterministes.
- **Décision** : un seul orchestrateur. Chaque agent est une fiche (mission, département, responsable, outils, permission maximale, modèle, budget, critères de validation) avec un mode `deterministe`, `assiste` ou `autonome`.
- **Objection du Devil's Advocate** : on risque de transformer les « agents » en simples étiquettes posées sur des fonctions, et de perdre la dimension organisationnelle voulue par le fondateur.
- **Réponse** : chaque agent, même déterministe, reçoit des missions, produit un livrable, est journalisé, a un statut et un responsable, et apparaît dans l'Agent Center avec un badge de mode. L'organisation est réelle. Seul le moteur d'exécution s'adapte à la tâche, ce qui satisfait aussi l'exigence de coûts maîtrisés (partie 12).
- **Révision si** : un agent déterministe montre un besoin réel de jugement. Il passe alors en mode `assiste`, par une modification soumise à validation.

## D-004 — API Messages d'Anthropic + Tool Runner plutôt que Managed Agents
- **Date** : 2026-11-20 · **Statut** : Acceptée, réévaluation en phase 7
- **Contexte** : Anthropic propose aussi Managed Agents (en bêta), où Anthropic héberge la boucle de l'agent et un conteneur par session.
- **Décision** : l'orchestrateur tourne dans notre worker et utilise l'API Messages avec le Tool Runner du SDK TypeScript.
- **Raisons** : les outils des agents sont presque tous nos propres services, soumis à la RLS de chaque client. Les permissions, budgets, approbations et journaux doivent vivre dans notre base pour l'Agent Center et la facturation par organisation. Managed Agents facture aussi le temps de session, conserve l'historique des sessions chez Anthropic, et reste en bêta.
- **Objection du Devil's Advocate** : on réécrit une boucle d'agent qui existe déjà en service managé, ce qui fait plus de code à maintenir.
- **Réponse** : le Tool Runner du SDK fournit déjà la boucle. Notre code se limite aux outils, aux contrôles d'accès et à la journalisation, qu'il faudrait écrire de toute façon. Managed Agents reste une option pour les recherches longues de l'organisation entreprise.
- **Révision** : en phase 7, ou si la maintenance de la boucle devient significative.

## D-005 — pg-boss (file de tâches sur PostgreSQL) plutôt que BullMQ + Redis
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Décision** : les files, priorités, reprises, délais et tâches planifiées passent par pg-boss. Il n'y a pas de Redis au départ.
- **Objection du Devil's Advocate** : les performances de PostgreSQL comme file de messages sont inférieures à celles de Redis.
- **Réponse** : les volumes prévus (alertes, rapports, exécutions d'agents) se comptent en milliers de tâches par heure, très en dessous des limites. Un service de moins à opérer et à sécuriser.
- **Critère de sortie** : latence de mise en file supérieure à 1 s au 95e centile, ou plus de 50 tâches par seconde en continu. On migre alors vers BullMQ, derrière la même interface.

## D-006 — Séparer l'Organisation Produit de l'Organisation Entreprise
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Décision** : les agents au service des clients n'opèrent que dans l'organisation du client. Les agents de pilotage du SaaS (CEO, C-level, croissance, support…) n'accèdent à aucune donnée personnelle des clients, seulement à des agrégats anonymisés.
- **Objection du Devil's Advocate** : le CEO Agent ne pourra pas « tout voir », alors que le cahier des charges lui demande une vision globale.
- **Réponse** : sa vision globale porte sur les indicateurs (usage, coûts, échecs, satisfaction), pas sur le CRM d'une agence. C'est une obligation RGPD : ImmoPilot est sous-traitant et ne peut pas réutiliser les données de ses clients pour ses propres besoins.
- **Révision** : non, sauf évolution juridique.

## D-007 — DVF : fichiers nationaux de static.data.gouv.fr, pages non indexables
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Contexte** : le répertoire DVF par commune (`files.data.gouv.fr/geo-dvf`) est archivé, avec une suppression annoncée fin novembre 2026. Les livraisons courantes sont des fichiers nationaux dont l'URL change à chaque livraison. Les conditions DGFiP interdisent la réidentification et l'indexation par les moteurs de recherche.
- **Décision** : l'ingestion lit l'URL dans les métadonnées data.gouv, charge en base, regroupe les lignes par `id_mutation` et nettoie. Les pages DVF sont réservées aux utilisateurs connectés ou marquées `noindex`. Aucun croisement DVF × CRM.
- **Objection du Devil's Advocate** : les pages de prix publiques sont le principal levier SEO des sites immobiliers grand public. Les interdire freine l'espace particuliers.
- **Réponse** : c'est une contrainte légale, pas un choix. Le SEO reposera sur des contenus agrégés (statistiques par commune, guides) en vérifiant que ce format est conforme aux conditions de réutilisation. Point ajouté à la fiche juridique de la phase 1.

## D-008 — Roadmap réordonnée
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Décision** : le socle d'agents passe avant les outils professionnels ; l'organisation entreprise après les premiers modules ; l'espace particuliers après la monétisation ; la préproduction dès la phase 3 ; la qualité en continu. Voir la section 8 de l'audit.
- **Objection du Devil's Advocate** : le fondateur a placé l'organisation multi-agents au cœur du projet. La repousser en phase 7 peut le décevoir.
- **Réponse** : le **moteur** d'agents arrive dès la phase 5 et sert tous les modules. Seule la couche de gouvernance (Council, cycle de décision) vient en phase 7, quand elle aura de vrais sujets et de vraies données à traiter. Une gouvernance construite à vide produirait des débats fictifs, ce que le cahier des charges interdit.

## D-009 — Conserver `vercel.json` jusqu'à la phase 3
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Contexte** : ce fichier pointe vers un dossier `public/` absent. Un projet Vercel relié au dépôt pourrait en dépendre.
- **Décision** : ne pas y toucher maintenant. Il sera remplacé par la configuration du monorepo en phase 3, après vérification avec le fondateur de l'existence d'un projet Vercel relié.

## D-010 — Environnement cloud dédié « lucas »
- **Date** : 2026-11-20 · **Statut** : Acceptée (approuvée par le fondateur via l'invite d'approbation)
- **Décision** : un environnement personnel limité aux domaines des données publiques françaises listés dans l'audit (section 1.3), sans accès réseau illimité.
- **Révision** : chaque nouveau domaine (fournisseur d'annonces, API Anthropic, Stripe…) est ajouté explicitement, au moment où il devient nécessaire.
