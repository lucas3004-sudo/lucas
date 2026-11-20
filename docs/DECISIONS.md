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
- **Mise à jour du 2026-11-20 (phase 1)** : ajout de `static.data.gouv.fr` (fichiers DVF et loyers), `www.insee.fr` (BPE) et `transport.data.gouv.fr`.

## D-011 — Origine des annonces : les flux des agences d'abord, un fournisseur seulement après vérification juridique
- **Date** : 2026-11-20 · **Statut** : Acceptée (devis autorisés par le fondateur, sans engagement)
- **Contexte** : Jinka a été condamnée deux fois (CA Versailles, 16/12/2025 au profit de SeLoger ; 200 000 € en avril 2026 au profit de Leboncoin). La réutilisation est interdite au même titre que l'extraction (art. L342-1 du CPI). Un fournisseur qui scrape exposerait ImmoPilot.
- **Décision** : priorité aux annonces des clients eux-mêmes (saisie, import, puis réception de leurs flux de diffusion). Un fournisseur tiers n'est retenu que s'il prouve des accords écrits avec ses sources et apporte une garantie contractuelle. Fluximmo est exclu (scraping revendiqué).
- **Objection du Devil's Advocate** : aucun fournisseur ne pourra peut-être prouver ses droits sur toutes ses sources, et l'Opportunity Finder restera limité.
- **Réponse** : c'est possible. On l'assume et on le présente honnêtement aux clients. Un réseau de partage volontaire de mandats entre utilisateurs (sur le modèle du Fichier AMEPI) est une piste à soumettre au Council en phase 7.

## D-012 — Loyers : Carte des loyers ANIL 2025, avec son intervalle
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Décision** : le loyer par défaut des simulations vient de la Carte des loyers 2025 (loyer d'annonce, charges comprises, non meublé, 3e trimestre 2025). On affiche l'intervalle de prédiction, la qualité du modèle (R², nombre d'observations) et la citation imposée. L'utilisateur peut toujours remplacer la valeur.
- **Objection du Devil's Advocate** : un loyer d'annonce surestime le loyer réellement signé, ce qui gonfle les rendements affichés.
- **Réponse** : c'est exact. Le produit le dit explicitement, propose par défaut la borne basse de l'intervalle pour les calculs de rentabilité, et laisse l'utilisateur saisir le loyer réel.

## D-013 — L'apprentissage reste à l'intérieur de chaque organisation
- **Date** : 2026-11-20 · **Statut** : Acceptée, **règle permanente**
- **Contexte** : un éditeur qui réutilise les données de ses clients pour améliorer son service perd son statut de sous-traitant RGPD et devient responsable de traitement pour ces données.
- **Décision** : les retours et l'historique d'une organisation n'améliorent que les agents de cette organisation. Au niveau global, on n'utilise que des métriques agrégées et anonymisées. Aucune donnée client ne sert à entraîner un modèle. Cela complète D-006.

## D-014 — Grille tarifaire de lancement
- **Date** : 2026-11-20 · **Statut** : **Acceptée par le fondateur** (prix d'entrée)
- **Décision** : Investisseur 19 €, Solo 59 €, Pro 99 €, Agency 249 € HT (3 utilisateurs, puis 49 € par utilisateur supplémentaire), Business sur devis. Arguments et calculs : `docs/phase-1-strategie.md`, section 2.
- **Règle** : aucune formule n'est vendue avant que ses fonctions existent et soient testées.

## D-015 — Cible prioritaire : les petites agences (2 à 10 personnes)
- **Date** : 2026-11-20 · **Statut** : **Acceptée, choix du fondateur** (la recommandation initiale visait les indépendants)
- **Conséquences** : la formule Agency devient la formule phare. Rôles et visibilité dès le MVP. Matching à l'échelle de l'agence. Tableau de bord du gérant (F13). Import depuis le logiciel de l'agence. Détail : `docs/phase-1-strategie.md`, section 1 bis.
- **Objections du Devil's Advocate et réponses** : voir la section 1 bis (cycle de vente plus long, MVP plus lourd, risque de surveillance des salariés : question ajoutée pour l'avocat).

## D-016 — Isolation : RLS restrictive, appartenance vérifiée par la base, contexte par transaction
- **Date** : 2026-11-20 · **Statut** : Acceptée, **validée par prototype** (`prototypes/rls`, 12 tests sur 12)
- **Décision** :
  - rôle applicatif non propriétaire et sans contournement de la RLS ;
  - `FORCE ROW LEVEL SECURITY` ;
  - politique restrictive d'isolation + politiques permissives de visibilité ;
  - rôle de l'utilisateur **lu dans la base** à partir de l'adhésion, et non fourni par l'application ;
  - contexte fixé **uniquement en mode transaction**.
- **Règles qui en découlent** :
  - `SET` sans `LOCAL` et `set_config(…, false)` sont interdits (le test T11 prouve la fuite) ;
  - tout test de refus a un contrôle positif ;
  - un test de CI vérifie qu'aucune table portant `org_id` n'échappe à la RLS.
- **Défaut trouvé par le prototype** : avec `FORCE`, il faut une politique explicite pour la fonction `SECURITY DEFINER` qui lit les adhésions.

## D-017 — Règles de nettoyage DVF R1 à R5
- **Date** : 2026-11-20 · **Statut** : Acceptée, **mesurée sur données réelles** (Amiens 2025)
- **Décision** : les règles R1 à R5 de `docs/phase-2/ingestion.md`. Le neuf (VEFA) est séparé de l'ancien. Les ventes de plusieurs logements sont exclues. Les résultats du prototype deviennent des tests de non-régression.
- **Objection du Devil's Advocate** : exclure 624 ventes sur 2 305 (27 %) réduit le nombre de comparables dans les petites communes.
- **Réponse** : c'est vrai, mais garder ces ventes fausse la médiane de 20 %. Le rayon de recherche s'élargit par paliers, et le niveau de confiance affiché baisse quand les comparables manquent. Mieux vaut moins de données justes que beaucoup de données fausses.

## D-018 — Fiches d'agents dans le code, approbation humaine L3 non désactivable
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Décision** :
  - les fiches d'agents (outils, plafonds, budgets, modèles) sont versionnées dans git et synchronisées au démarrage avec contrôle d'empreinte ;
  - l'interface permet seulement d'activer ou de désactiver un agent ;
  - les actions L3 exigent une approbation humaine à chaque fois, sans réglage pour l'automatiser ;
  - les droits d'un agent sont l'intersection de ceux de l'utilisateur, de sa liste d'outils et de son plafond.
- **Objection du Devil's Advocate** : des agences voudront automatiser leurs relances par e-mail, et devoir les approuver une par une va les frustrer.
- **Réponse** : au MVP, l'approbation se fait **par lot** (une validation pour une liste d'envois préparés et visibles), ce qui reste une validation humaine explicite. Un envoi automatique sans validation n'est envisageable qu'après l'avis de l'avocat sur la prospection, et par une nouvelle décision.

## D-019 — DPE : rapprochement par identifiant BAN, choix humain si plusieurs DPE
- **Date** : 2026-11-20 · **Statut** : Acceptée (5 rapprochements sur 5 vérifiés à Amiens)
- **Décision** : rapprochement par `identifiant_ban`. Si plusieurs DPE correspondent à la même adresse, l'utilisateur choisit dans une liste. Sans DPE, le statut `manquante` est affiché. Un DPE antérieur à 2026 pour un logement chauffé à l'électricité porte une alerte.

## D-020 — Préproduction sur des offres gratuites : Vercel Hobby + Supabase Free
- **Date** : 2026-11-20 · **Statut** : **Choix du fondateur** (« hébergement gratuit ») ; création des comptes en attente de son accord
- **Décision** : site sur Vercel (offre Hobby), base PostgreSQL + PostGIS sur Supabase (offre gratuite, région européenne). Le code reste portable vers n'importe quel PostgreSQL.
- **Limites connues** (vérifiées le 2026-11-20) :
  - l'offre Vercel Hobby est réservée à un **usage personnel et non commercial** : il faudra passer sur une offre payante ou changer d'hébergeur **avant toute vente** ;
  - Supabase Free : base de 500 Mo, **mise en veille après une semaine sans activité** ; la préproduction ne couvrira DVF que pour quelques départements ;
  - les tâches de fond (worker) de la phase 5 devront tourner ailleurs (fonctions limitées à 300 s sur Vercel Hobby). À décider en phase 5.
- **Objection du Devil's Advocate** : construire la préproduction sur un hébergement qu'il faudra quitter crée une migration future.
- **Réponse** : le code n'utilise aucune fonction propre à Vercel ou à Supabase (PostgreSQL standard, Next.js standard). La migration se limitera à changer des variables d'environnement.

## D-021 — Routes HTTP de gestion d'agence fermées
- **Date** : 2026-11-20 · **Statut** : Acceptée, **testée** (scénario de bout en bout : réponse 404, même connecté)
- **Contexte** : les crochets (« hooks ») de Better Auth reçoivent le membre visé, pas l'auteur de l'action. Ils ne permettent donc pas d'empêcher un manager de nommer un gérant en appelant l'API directement.
- **Décision** : les 35 routes `/api/auth/organization/*` sont fermées (`disabledPaths`). Toutes les opérations passent par des actions serveur qui :
  - vérifient le rôle de l'auteur, lu par la base ;
  - appliquent les règles testées de `rules.ts` (dont : un manager ne nomme jamais de gérant, l'agence garde toujours un gérant) ;
  - journalisent l'action.

## D-022 — Limitation des tentatives stockée en base, 10 connexions par minute et par adresse IP
- **Date** : 2026-11-20 · **Statut** : Acceptée, **testée** (réponse 429 constatée)
- **Décision** : le compteur de Better Auth est stocké en base (table `iam.rateLimit`), donc valable avec plusieurs instances. La connexion est limitée à 10 tentatives par minute et par IP, l'inscription à 5.
- **Raison du seuil** : avec 5 tentatives, le blocage est arrivé dès la 3e tentative pendant les tests. Une équipe d'agence partage souvent la même IP de bureau.

## D-023 — Invitations par lien, vérification d'e-mail reportée (lacune connue)
- **Date** : 2026-11-20 · **Statut** : Acceptée **temporairement**
- **Contexte** : envoyer des e-mails exige un compte chez un prestataire (Brevo, Resend…), donc l'accord du fondateur.
- **Décision** : l'invitation est un lien à copier (7 jours). Elle n'est acceptable que par un compte dont l'adresse correspond à l'adresse invitée.
- **Lacune** : sans vérification d'e-mail, une personne qui obtiendrait le lien **et** créerait la première un compte à l'adresse invitée pourrait rejoindre l'agence. **La vérification d'e-mail est obligatoire avant toute utilisation par de vraies agences** (inscrite dans les blocages de PROGRESS.md).

## D-024 — Migrations SQL écrites à la main, schéma Drizzle pour le typage
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Décision** :
  - les migrations SQL (`packages/db/migrations`) sont la source de vérité, car les politiques RLS, les rôles et les fonctions s'écrivent en SQL ;
  - le schéma Drizzle sert au typage des requêtes ;
  - les tables d'authentification sont générées par Better Auth à partir de la configuration réelle, relues, puis figées dans une migration ;
  - une migration publiée n'est jamais modifiée (contrôle d'empreinte).

## D-025 — TypeScript 5.9 plutôt que 7.0
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Raison** : TypeScript 7 (réécriture native) est très récent. Les outils (Next.js, ESLint, Vitest) sont éprouvés avec la version 5. Réévaluation en phase 9.
