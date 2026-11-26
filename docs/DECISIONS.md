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

## D-026 — Schéma d'authentification « iam », et non « auth »
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Contexte** : Supabase réserve le schéma `auth` à son propre service de connexion. Y créer nos tables risquait de casser Supabase ou d'entrer en conflit avec ses mises à jour.
- **Décision** : le schéma est renommé `iam` avant tout déploiement. Les migrations ont été corrigées sur place : elles n'avaient été appliquées qu'aux bases locales, recréées ensuite. Le chemin de recherche du rôle `app_auth` est fixé en base (`ALTER ROLE … SET search_path`), compatible avec les répartiteurs de connexions.

## D-027 — Aucun accès propriétaire à la base depuis le site
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Décision** : le site (Vercel) ne reçoit que les identifiants `app_user` et `app_auth`. Les migrations sont appliquées sous `app_owner` via le connecteur Supabase, avant le déploiement du code qui en dépend. La procédure figure dans `docs/deploiement-preprod.md`.
- **Objection du Devil's Advocate** : l'application manuelle des migrations est une source d'oubli (un code déployé sans sa migration).
- **Réponse** : c'est vrai. Le risque est accepté en préproduction. Avant la production, on ajoutera un contrôle au démarrage : l'application refusera de démarrer si une migration connue du code manque en base.

## D-028 — Export PDF par l'impression du navigateur
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Décision** : le bouton « Imprimer / PDF » utilise l'impression du navigateur, avec une mise en page dédiée (navigation et boutons masqués, fond blanc). Le document est identique à l'écran (critère F2), sans serveur de rendu.
- **Raison** : un rendu PDF côté serveur exige un navigateur sans interface (Chromium), indisponible sur l'hébergement gratuit (fonctions sans serveur).
- **Révision** : PDF serveur à l'image de l'agence (logo, mentions) quand le worker existera (phase 5).

## D-029 — Comparables affichés sans adresse
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Décision** : les ventes comparables montrent la date, la surface, le prix, le prix au m² et la distance, mais **jamais l'adresse**. C'est une précaution vis-à-vis de l'interdiction de réidentification (art. R112 A-3 du LPF, D-007) : la valeur d'argumentation reste entière.

## D-030 — Ingestion DVF par département, nettoyage commune par commune
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Décision** :
  - les fichiers nationaux sont lus en flux ;
  - seuls les départements demandés sont conservés ;
  - les règles R1 à R5 sont appliquées commune par commune (comme le prototype et le test de référence), puis les ventes du département sont remplacées en une transaction tracée dans `ref.source_runs` ;
  - fenêtre par défaut : les 3 derniers fichiers (environ 24 mois et une marge).
- **Objection du Devil's Advocate** : dans une petite commune, R5 s'applique sur peu de ventes (moins de 8) et ne retient alors que les bornes absolues de 200 et 25 000 €/m².
- **Réponse** : c'est vrai. Le niveau de confiance de l'estimation baisse dans ce cas (moins de 8 comparables : confiance « faible »). Un R5 au niveau de l'EPCI pourra être étudié avec plus de départements.

## D-031 — Critères des profils d'acquéreurs lisibles par toute l'agence, identité protégée
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Contexte** : le matching doit se faire à l'échelle de l'agence (D-015, F6), même quand un négociateur garde ses acquéreurs en « privé ».
- **Décision** :
  - les **critères** d'un profil de recherche (type, budget, surface, pièces, communes, équipements) sont lisibles par tous les membres de l'agence ;
  - l'**identité** reste protégée par la visibilité du contact : pour un collègue, l'acquéreur s'affiche « Acquéreur de [responsable] (privé) » ;
  - « Prévenir » crée une tâche pour le responsable, qui décide seul de la suite.
- **Objection du Devil's Advocate** : un budget et une commune peuvent, dans un petit village, suffire à deviner qui cherche.
- **Réponse** : c'est vrai. Le risque est limité à l'intérieur d'une même agence, dont les membres sont tenus au secret professionnel. On peut le réduire plus tard : afficher une fourchette de budget au lieu du montant, ou laisser le gérant désactiver le partage des critères.

## D-032 — Seuils anti-abus de connexion réglables pour les tests
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Décision** : les seuils d'inscription (5 par minute) et de connexion (10 par minute) peuvent être relevés par les variables `AUTH_RATE_LIMIT_SIGNUP` et `AUTH_RATE_LIMIT_SIGNIN` (entier de 1 à 1000). Seule la CI les relève, car les tests créent une douzaine de comptes en quelques secondes depuis une seule adresse IP. Sans variable, les valeurs de production s'appliquent.

## D-033 — Consentements en ajout seul
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Décision** :
  - un consentement de prospection ne se modifie ni ne s'efface : un retrait est une nouvelle ligne, et la dernière ligne par canal fait foi ;
  - la preuve (où, quand, comment) est obligatoire ;
  - la base refuse toute modification (aucune politique UPDATE ni DELETE).
- **Raison** : en cas de contestation, l'agence doit montrer quand et comment l'accord a été obtenu, puis retiré (fiche juridique, prospection).
- **Limite** : la suppression du contact efface ses consentements (droit à l'effacement). Une conservation de la seule preuve du retrait, sous forme anonymisée, sera étudiée avec l'avocat.

## D-034 — Le CRM et le matching avant les agents IA
- **Date** : 2026-11-20 · **Statut** : Acceptée (choix du fondateur)
- **Décision** : la partie CRM et matching de la phase 6 est construite avant la phase 5 (agents). Une petite agence peut ainsi utiliser l'outil sans IA, et les agents auront ensuite de vraies données métier à traiter.

## D-035 — Investment Studio : rendements sur le coût total, avant impôt, simulation dans le lien
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Décision** :
  - les rendements sont calculés sur le **coût total** d'acquisition (prix, frais, travaux, mobilier), et non sur le seul prix : c'est plus prudent ;
  - tous les résultats sont **avant impôt** : la fiscalité dépend de la situation de chacun, et aucun conseil fiscal n'est donné ;
  - la simulation n'est pas enregistrée : ses hypothèses sont dans le lien de la page (aucune table, aucune donnée personnelle) ;
  - le repère de loyer ANIL (charges comprises) est affiché mais ne remplit jamais le loyer hors charges.
- **Objection du Devil's Advocate** : beaucoup d'annonces affichent un rendement « loyer / prix ». Le nôtre paraîtra plus faible que celui des concurrents.
- **Réponse** : c'est vrai. La définition est écrite à l'écran, sous les résultats. Un chiffre prudent et expliqué vaut mieux qu'un chiffre flatteur.

## D-036 — Pilotage du gérant : activité mesurée par le journal d'audit, sans classement
- **Date** : 2026-11-20 · **Statut** : Acceptée
- **Décision** :
  - l'activité par membre se compte à partir du journal d'audit, qui ne fait qu'ajouter des lignes, et des dates de fin des tâches ;
  - la création manuelle d'une tâche est désormais journalisée (identifiant seulement) ;
  - les membres sont affichés par ordre alphabétique, sans aucun tri par performance ;
  - un bien est « sans acquéreur » si aucun profil actif n'atteint 50 % avec les pondérations par défaut.
- **Raison** : la stratégie (F13) exclut tout classement automatique des personnes. Un tableau de bord sert à repérer ce qui bloque (biens non couverts, relances en retard), pas à noter les gens.
- **Objection du Devil's Advocate** : même sans tri, un tableau de chiffres par personne permet de comparer les membres, et peut servir de surveillance.
- **Réponse** : c'est vrai. Les chiffres se limitent à l'activité dans l'outil, sur une période choisie. Il n'y a ni horaires, ni connexions, ni durées. L'accès est réservé au gérant et aux managers. L'information des salariés sur cet outil fera partie des questions à l'avocat (CSE, information préalable).

## D-037 — Rendez-vous : export .ics à télécharger plutôt qu'un abonnement d'agenda
- **Date** : 2026-11-21 · **Statut** : Acceptée
- **Décision** :
  - les rendez-vous s'exportent en fichiers .ics téléchargés par l'utilisateur connecté, un par rendez-vous ou tous ensemble ;
  - il n'y a pas encore d'adresse d'abonnement que l'agenda interrogerait seul ;
  - les heures sont saisies en heure de Paris et enregistrées en UTC ; une heure inexistante (passage à l'heure d'été) est refusée ;
  - la visibilité suit celle des tâches : organisateur, auteur, gérant et managers.
- **Raison** : un abonnement exige une adresse secrète, lisible sans connexion, qui exposerait des noms et des adresses si elle fuitait. Il faudrait un jeton révocable, à durée limitée et journalisé : c'est à construire avec le socle de sécurité.
- **Objection du Devil's Advocate** : sans abonnement, un rendez-vous déplacé n'est pas mis à jour dans l'agenda personnel.
- **Réponse** : c'est vrai. L'identifiant du rendez-vous et sa date de modification sont exportés : un nouvel import met donc à jour l'événement existant au lieu de le dupliquer, et un rendez-vous annulé est retiré. L'abonnement sécurisé est noté pour la phase 9.

## D-038 — Import CSV : aperçu, puis import revérifié par le serveur ; jamais de consentement importé
- **Date** : 2026-11-21 · **Statut** : Acceptée
- **Décision** :
  - l'import se fait en deux temps : un aperçu sans écriture, puis la confirmation. À la confirmation, le serveur relit tout le fichier ; l'aperçu renvoyé par le navigateur n'est jamais repris tel quel ;
  - les doublons sont écartés, jamais fusionnés ;
  - une ligne invalide est ignorée et sa raison affichée ;
  - les consentements de prospection ne sont jamais importés, faute de preuve individuelle ;
  - un bien n'est créé que si la BAN reconnaît une adresse précise (numéro ou rue, score d'au moins 50 %) ;
  - limites : 1 Mo par fichier, 2 000 contacts ou 200 biens par import (géocodage 5 adresses à la fois).
- **Objection du Devil's Advocate** : une agence qui change de logiciel voudra reprendre ses consentements existants.
- **Réponse** : c'est vrai. Un consentement sans preuve ne protège pas l'agence en cas de contrôle. Une reprise « avec preuve jointe » (colonne date, colonne preuve) pourra être étudiée avec l'avocat (question 3 de la fiche juridique).

## D-039 — Alertes de correspondance à la création d'un bien, sans tâche de fond
- **Date** : 2026-11-21 · **Statut** : Acceptée
- **Décision** :
  - à la création ou à l'import d'un bien proposé, les correspondances sont calculées dans la même transaction ;
  - chaque collègue concerné (au moins 75 %) reçoit une tâche, sans identité révélée ;
  - il n'y a pas encore de recalcul périodique, faute de « worker » (le travail de fond arrive avec le socle d'agents, phase 5) ;
  - un profil créé après le bien affiche ses correspondances sur la fiche du contact, et le bouton « Prévenir » reste disponible côté bien.
- **Objection du Devil's Advocate** : un acquéreur ajouté ou modifié après coup ne déclenche aucune alerte vers le responsable du bien.
- **Réponse** : c'est vrai. La fiche de l'acquéreur montre immédiatement les biens correspondants : son propre responsable les voit donc. L'alerte dans l'autre sens (nouveau profil vers les responsables des biens) sera ajoutée avec le worker.

## D-040 — Affaires : visibilité héritée du bien, échéances indicatives
- **Date** : 2026-11-21 · **Statut** : Acceptée
- **Décision** :
  - une affaire est lisible si son bien l'est : pas de réglage de visibilité en plus ;
  - le statut du bien suit l'étape (sous offre, puis vendu) ;
  - les échéances sont calculées et affichées avec leur règle ; elles sont « indicatives » ;
  - la liste des pièces est indicative ;
  - aucune information n'est envoyée aux parties : ImmoPilot ne notifie rien à leur place.
- **Raison** : le notaire est responsable des actes et des délais. Un rappel clair et sourcé aide l'agent sans se substituer au notaire.
- **Objection du Devil's Advocate** : un agent pourrait se fier au calcul et manquer une particularité (lettre recommandée non retirée, jour férié local).
- **Réponse** : c'est vrai. La règle est affichée sous la date, la mention « indicative » est visible, et la date de départ est celle que l'agent saisit (première présentation). Le point figurera dans les questions à l'avocat (formulation des aides au calcul de délai).

## D-041 — Annonce sans IA d'abord, copie bloquée si une mention obligatoire manque
- **Date** : 2026-11-21 · **Statut** : Acceptée
- **Décision** :
  - avant toute IA, l'annonce est assemblée à partir des données saisies : titre, texte de l'agent repris tel quel, caractéristiques, prix et honoraires, DPE, copropriété, Géorisques ;
  - tant qu'une mention obligatoire manque, la copie est bloquée ;
  - le lien vers le barème des honoraires est un paramètre de l'agence.
- **Raison** :
  - cela rend service tout de suite, sans coût ni compte externe ;
  - aucune caractéristique ne peut être déformée (règle permanente du Listing Copywriter) ;
  - la rédaction par IA viendra en surcouche, marquée « générée par IA ».
- **Objection du Devil's Advocate** : le contrôle peut donner un faux sentiment de conformité, alors que certaines bases sont « à confirmer ».
- **Réponse** : c'est vrai. L'écran parle de « contrôle indicatif, à faire valider par l'avocat ». La liste des mentions figure dans les questions à l'avocat (fiche juridique) et sera ajustée après sa réponse.

## D-042 — Photos stockées en base (préproduction), à déplacer vers un stockage d'objets avant la production
- **Date** : 2026-11-21 · **Statut** : Acceptée (provisoire)
- **Décision** :
  - les photos sont stockées dans PostgreSQL (`bytea`), sous la même RLS que le bien ;
  - le serveur n'accepte que JPEG et PNG, retire les métadonnées (dont le GPS) et limite chaque photo à 1,5 Mo ;
  - 15 photos au plus par bien.
- **Raison** : l'isolation entre agences est garantie par la base sans nouveau service ni nouvelle clé. Le site ne reçoit toujours que ses identifiants limités (D-027). Rien à créer ni à payer.
- **Limite** : le plan gratuit de Supabase compte 500 Mo de base. À environ 300 Ko par photo, cela fait de l'ordre de 100 à 150 biens entièrement illustrés.
- **Révision prévue avant la production** :
  - passage à un stockage d'objets (Supabase Storage ou équivalent), avec des liens signés de courte durée ;
  - la clé de stockage restera côté serveur.
  Cela demandera l'accord du fondateur (compte ou offre payante selon le volume).

## D-043 — Double authentification : disponible pour tous, rappelée au gérant, obligatoire avant la production
- **Date** : 2026-11-21 · **Statut** : Acceptée
- **Décision** :
  - double authentification par application (TOTP) et codes de secours, avec l'extension de Better Auth (migration 0013 dans `iam`) ;
  - pour l'instant, un bandeau la rappelle au gérant et aux managers, sans blocage ;
  - elle deviendra **obligatoire pour ces rôles avant la mise en production**, une fois les premiers utilisateurs accompagnés.
- **Raison** : rendre l'activation obligatoire dès maintenant bloquerait l'accès en préproduction sans procédure de récupération. Cette procédure (perte du téléphone et de tous les codes de secours) demande un e-mail vérifié, donc un service d'envoi (Brevo, en attente).
- **Objection du Devil's Advocate** : un gérant peut ignorer le bandeau indéfiniment.
- **Réponse** : c'est vrai. L'obligation est inscrite dans les lacunes à combler avant la production (PROGRESS.md). Le pilotage pourra afficher, pour le gérant, les membres sans double authentification.

## D-044 — Agents : d'abord déterministes, approbation obligatoire dès L2, exécution avec l'identité du décideur
- **Date** : 2026-11-21 · **Statut** : Acceptée (choix du fondateur : « continuer sans IA ni compte »)
- **Décision** :
  - le socle (fiches versionnées, passerelle d'outils, missions, approbations, Agent Center) est construit avec quatre agents déterministes, sans appel à un modèle ;
  - toute action L2 ou L3 proposée par un agent devient une demande d'approbation ;
  - l'action approuvée s'exécute avec l'identité de celui qui l'approuve, dans la transaction de la décision ;
  - la fusion de contacts est réservée au gérant et aux managers, car elle supprime une fiche (droit de suppression du tableau des rôles).
- **Raison** : la sécurité des agents se joue dans la passerelle et les approbations, pas dans le modèle. Les tester sans IA permet de brancher l'IA ensuite sur un socle déjà vérifié.
- **Objection du Devil's Advocate** : sans worker, une mission s'exécute pendant la requête : un gros volume rendrait la page lente.
- **Réponse** : c'est vrai. Les budgets d'étapes plafonnent chaque mission (au plus 120 étapes) et les agents actuels sont rapides. Le worker, prévu avec l'IA, prendra le relais.

## D-045 — CSP stricte à nonce par requête
- **Date** : 2026-11-21 · **Statut** : Acceptée (durcissement prévu en phase 9, avancé)
- **Décision** :
  - chaque page reçoit une politique de sécurité du contenu avec un nonce aléatoire par requête (`src/proxy.ts`) : `script-src 'self' 'nonce-…' 'strict-dynamic'`, sans `unsafe-inline` pour les scripts ;
  - les routes d'API reçoivent une politique fixe totalement fermée (`default-src 'none'; sandbox`) ;
  - les styles en ligne restent autorisés (Tailwind et attributs `style` de React).
- **Vérification** : un test de bout en bout injecte un gestionnaire d'événement HTML (XSS typique). Il est bloqué. Un contrôle montre que la même injection s'exécute sans CSP. Les 21 autres scénarios passent : l'application fonctionne normalement.
- **Limite** : `strict-dynamic` fait confiance aux scripts créés par un script déjà autorisé. C'est le compromis standard : la protection porte sur l'injection de HTML, la forme la plus courante d'attaque.

## D-046 — Contrôle de version de la base au démarrage et état de santé public
- **Date** : 2026-11-21 · **Statut** : Acceptée (répond à l'objection de D-027)
- **Décision** :
  - le code connaît la liste exacte des migrations attendues (`EXPECTED_MIGRATIONS`), et un garde-fou de test vérifie qu'elle correspond aux fichiers ;
  - au premier accès à l'application, le site compare cette liste à `ops.schema_migrations`. Le rôle applicatif lit seulement les noms et les dates, pas les empreintes (migration 0015) ;
  - si une migration manque, l'application affiche « Mise à jour en cours » au lieu de fonctionner sur une base en retard ;
  - `/api/health` (public) renvoie l'état, avec des nombres seulement : 200 si à jour, 503 sinon.
- **Vérification** : la base de développement a été rendue volontairement « en retard », puis remise en état. `/api/health` a renvoyé 503, puis 200.

## D-047 — Aucune dépense d'IA pour l'instant ; l'abonnement Claude Pro ne peut pas servir aux agences
- **Date** : 2026-11-21 · **Statut** : Acceptée (choix du fondateur : « rien dépenser pour l'instant »)
- **Décision** :
  - pas de compte API Anthropic pour l'instant : les fonctions d'IA (Copilot, rédaction par IA, agents assistés) attendent ;
  - tout ce qui fonctionne sans IA continue d'avancer (coût 0 €).
- **Pourquoi l'abonnement Claude Pro ne convient pas** :
  - il sert à l'usage personnel de Claude, et c'est lui qui finance le travail de développement fait avec Claude Code ;
  - il ne fournit pas de clé d'API ;
  - les conditions d'Anthropic réservent l'abonnement à l'usage de son titulaire : un service rendu à des clients (les agences) doit passer par l'API, facturée à l'usage.
- **Quand le fondateur le décidera** :
  - le compte API est gratuit à créer, et les nouveaux comptes reçoivent des crédits d'essai (documentation officielle consultée le 2026-11-21) ;
  - sans carte bancaire enregistrée, aucun paiement n'est possible ;
  - un plafond mensuel réglable par le fondateur arrête l'IA quand il est atteint.
- **Rentabilité** : quotas par formule (grille de la phase 1 : coût IA maximal d'environ un tiers du prix), modèles économiques pour les tâches simples, cache et traitement différé. Le logiciel mesurera le coût réel par agence et arrêtera l'IA au quota.

## D-048 — Formules et quotas appliqués par le logiciel, sans paiement
- **Date** : 2026-11-21 · **Statut** : Acceptée (réponse à la question de rentabilité du fondateur) ; trois hypothèses à valider (ci-dessous)
- **Décision** :
  - la grille D-014 est appliquée par le logiciel. La formule de chaque agence est enregistrée en base (`app.agency_plans`, migration 0016) ;
  - la formule est attribuée par l'exploitant (rôle propriétaire). L'application peut seulement la lire, ce qui est testé ;
  - sans attribution, l'agence est en **Essai** : sans IA, 30 dossiers par mois, 500 contacts, 5 membres ;
  - les compteurs sont calculés par la base sur toute l'agence, éléments privés compris, sans révéler ces éléments (`app.agency_usage`, migration 0017) ;
  - au quota, l'ajout est refusé avec un message clair. Rien de ce qui existe n'est bloqué ni supprimé ;
  - une invitation en attente réserve une place ;
  - les quotas mensuels repartent à zéro le 1er à minuit, heure de Paris.
- **Pourquoi** : le coût de l'IA doit rester plafonné par agence. Le plafond existe avant que l'IA soit ouverte, et il s'appliquera dès son ouverture.
- **Hypothèses à valider** :
  - Investisseur : 100 contacts et 1 membre, absents de la grille ;
  - Essai : quotas de préproduction ;
  - Solo et Pro : « 1 utilisateur » appliqué comme 1 membre.
- **Limite** : le contrôle est souple (deux créations simultanées peuvent dépasser d'une unité). Il sera strict pour l'IA, avec une réservation avant l'appel au modèle.
- **Non construit** : le paiement en ligne. Il demandera un compte externe (Stripe ou équivalent), donc l'accord du fondateur.
- Détails : `docs/formules-et-quotas.md`.

## D-049 — Compte rendu de visite : texte au vendeur sans IA, sans l'identité des visiteurs, visible du responsable du bien
- **Date** : 2026-11-21 · **Statut** : Acceptée (décision technique réversible)
- **Décision** :
  - un compte rendu par visite (`app.visit_reports`, migration 0018), rédigé après la visite ;
  - le texte destiné au vendeur est assemblé à partir de réponses fermées (intérêt, avis sur le prix, suite) et de deux champs libres, sans IA ;
  - il ne contient jamais l'identité des visiteurs ;
  - lecture par l'auteur, l'organisateur, le responsable du bien, le gérant et les managers. Le responsable du bien en a besoin pour rendre compte au vendeur, même quand un collègue a fait la visite.
- **Pourquoi** : rendre compte au vendeur après chaque visite est une attente forte des mandants. Le faire sans IA coûte 0 € et reste disponible tant que l'IA n'est pas ouverte.
- **Prudence** : les champs libres peuvent contenir des données personnelles. Le formulaire le rappelle, et l'export RGPD d'un contact inclut les comptes rendus de ses visites.
- Détails : `docs/compte-rendu-visite.md`.

## D-050 — Accessibilité : WCAG 2.1 AA vérifié automatiquement à chaque modification
- **Date** : 2026-11-21 · **Statut** : Acceptée (décision technique réversible)
- **Décision** :
  - la cible est le niveau WCAG 2.1 AA (base du RGAA) ;
  - la CI bloque toute modification qui introduit une violation grave ou critique (axe-core 4.14.0) sur 27 pages, dans les deux thèmes, avec un passage mobile et un passage au clavier ;
  - un contrôle positif garantit que l'audit tourne vraiment.
- **Conséquence** : la teinte du texte discret est assombrie en thème clair (`#626b7e`) et éclaircie en thème sombre (`#8390a6`) pour atteindre 4,5:1. La hiérarchie visuelle avec le texte secondaire est un peu moins marquée : la lisibilité passe avant.
- **Limite** : l'audit automatique ne remplace pas un audit manuel, nécessaire pour une déclaration RGAA. Détails : `docs/accessibilite.md`.

## D-051 — Suivi des mandats : rappels sur la date saisie, sans calcul de délai légal ni registre officiel
- **Date** : 2026-11-21 · **Statut** : Acceptée (décision technique réversible)
- **Décision** :
  - chaque bien porte un numéro de mandat (unique dans l'agence), une date de signature et une date de fin (migration 0019) ;
  - le logiciel prévient 30 jours avant la fin, puis signale le mandat expiré ;
  - il ne calcule aucun délai légal (irrévocabilité, préavis) et ne se présente pas comme le registre des mandats.
- **Pourquoi** : le besoin courant est de ne pas laisser filer un mandat. Les délais légaux dépendent du contrat, et la tenue électronique du registre est une question juridique ouverte (fiche juridique, question n° 10).
- Détails : `docs/suivi-mandats.md`.

## D-052 — Export complet de l'agence : CSV par type, réservé au gérant avec double authentification
- **Date** : 2026-11-21 · **Statut** : Acceptée (décision technique réversible)
- **Décision** :
  - huit fichiers CSV compatibles Excel, téléchargés depuis les paramètres ;
  - les colonnes des contacts et des biens sont celles de l'import (aller-retour possible) ;
  - accès réservé au gérant, double authentification active ;
  - chaque export est journalisé sans donnée personnelle ;
  - les formules sont neutralisées (injection CSV).
- **Pourquoi** : la réversibilité rassure les agences et répond au RGPD. Exiger la double authentification limite le risque principal, l'exfiltration par un compte compromis.
- Détails : `docs/export-agence.md`.

## D-053 — Connexion acceptée depuis les adresses Vercel du projet (et seulement elles)
- **Date** : 2026-11-22 · **Statut** : Acceptée (correctif constaté en préproduction)
- **Constat** : le fondateur a ouvert le site par l'adresse propre au déploiement. L'inscription échouait (« Une erreur est survenue »). La cause, reproduite en local : l'authentification n'acceptait que l'adresse principale (403 « Invalid origin »).
- **Décision** :
  - sont acceptées l'adresse principale, l'adresse du déploiement (`VERCEL_URL`) et celle de sa branche (`VERCEL_BRANCH_URL`), fournies par Vercel et propres à ce projet ;
  - aucun joker sur `vercel.app`, où n'importe qui peut créer un site ;
  - ajout possible par `AUTH_TRUSTED_ORIGINS` (https uniquement) ;
  - un code d'erreur s'affiche désormais à côté du message générique, pour diagnostiquer à distance.
- **Vérification** : en local, l'adresse du projet passe (200), une adresse étrangère est refusée (403). 4 tests unitaires.

## D-054 — Carte des biens : fond IGN, Leaflet, repère « bonne affaire » par médiane DVF communale
- **Date** : 2026-11-23 · **Statut** : Acceptée (choix du fondateur : « carte gratuite »)
- **Décision** :
  - carte Leaflet sur fond IGN (public, sans clé ni coût) ;
  - biens de l'agence filtrables, et ventes DVF de la zone affichée, sans adresse ;
  - repère « bonne affaire » : écart du prix affiché au m² avec la médiane DVF de la commune (même type, 24 mois). Seuil ±10 % ; pas de verdict sous 10 ventes.
- **Pourquoi** : le fondateur veut chercher des biens sur une carte selon ses critères et repérer les meilleures offres. Sans annonces du marché (payantes, D-002), la carte s'appuie sur les biens de l'agence et les ventes réelles.
- **Limite affichée à l'écran** : c'est un repère, pas une estimation. L'état, l'étage et la vue ne sont pas pris en compte.
- Détails : `docs/carte-des-biens.md`.

## D-055 — Carte v2 : MapLibre et fond IGN épuré ; fiche du bien avec verdict chiffré
- **Date** : 2026-11-23 · **Statut** : Acceptée (demande du fondateur : carte « belle, professionnelle », annonces cliquables, critères complets)
- **Décision** :
  - **moteur vectoriel MapLibre GL** (libre, sans clé) sur le style PLAN IGN retouché pour un rendu épuré, avec la vue satellite de l'IGN ;
  - **regroupement des biens** et **recherche de lieu avec rayon** ;
  - **fiche du bien** façon annonce ;
  - **verdict calculé** par l'écart du prix au milieu de la fourchette estimée (±10 %), puis par la médiane communale à défaut.
- **Pourquoi pas Google Maps ou Mapbox** : payants au-delà d'un quota, et une clé à gérer. L'IGN est public, gratuit et officiel.
- **Sécurité** : la CSP autorise `data.geopf.fr` pour les images et les connexions, ainsi que `worker-src blob:` pour le moteur de carte ; les bulles sont construites sans HTML.

## D-056 — L'IA est activée pour l'analyse des annonces (révise D-047)
- **Date** : 2026-11-23 · **Statut** : Acceptée (choix du fondateur : « avec IA maintenant »)
- **Décision** :
  - le fondateur crée le compte API Anthropic et fixe un plafond mensuel ;
  - l'analyse rédigée par l'IA s'appuie **uniquement sur les chiffres réels** calculés par le logiciel ;
  - elle est comptée dans le quota « annonces IA » de chaque formule (D-048) ;
  - le coût de chaque appel est mesuré.
- **Inchangé** : aucune autre fonction d'IA n'est ouverte sans décision.

## D-057 — Paiement réel par Stripe, avec 14 jours d'essai gratuit
- **Date** : 2026-11-23 · **Statut** : Acceptée (choix du fondateur), construction en cours
- **Décision** :
  - page d'accueil publique et page des prix gratuites ;
  - le logiciel n'est accessible qu'avec un abonnement payé, après **14 jours d'essai gratuit** ;
  - paiement par **Stripe** (compte créé par le fondateur), construit et testé d'abord en **mode test** (fausses cartes) ;
  - passage au paiement réel après validation du fondateur.
- **Coût** : commission Stripe par paiement (environ 1,5 % + 0,25 € par carte européenne standard selon sa page de tarifs, à vérifier dans le tableau de bord). Aucun abonnement fixe.

## D-058 — Page d'accueil refaite : scène animée au défilement, verre dépoli, ambiance « heure dorée »
- **Date** : 2026-11-23 · **Statut** : Acceptée (demande du fondateur : un site « comme iko-os », puis comme le SaaS montré dans une vidéo TikTok d'agence web, « où tout se transforme » au défilement, avec les skills Apple)
- **Décision** :
  - **scène d'ouverture collante** : le titre s'efface, la fenêtre du logiciel « s'allume » (ouverture en cercle, du flou vers le net) puis se transforme au fil du défilement : carte → analyse (les courbes se déforment de 1 à 5 ans) → acquéreurs → mandats ; la couleur d'accent glisse d'une étape à l'autre ;
  - le défilement est converti en quelques variables CSS (aucun rendu React pendant le défilement) ; seules la transparence, la position et l'échelle sont animées, plus un flou court entre deux états ;
  - ensuite une **feuille claire** glisse par-dessus : vraies captures qui défilent de côté, fonctions en **verre dépoli** qui basculent en 3D à l'apparition, compteurs, tarifs, questions, appel final ;
  - polices : Sora (titres), Instrument Serif en italique (mots mis en valeur), Inter (texte), toutes hébergées par le site ;
  - pages de connexion et d'inscription au même style.
- **Garde-fous** :
  - **mouvements réduits** (réglage du système) ou JavaScript absent : mise en page statique, tout reste lisible ;
  - la maquette animée porte la mention « Exemple » ; les captures réelles sont signalées comme telles ; les quotas d'IA affichent « bientôt » tant que l'IA n'est pas ouverte ;
  - audit d'accessibilité étendu à **toute** la page d'accueil (après défilement complet, et en mouvements réduits), en thèmes clair et sombre.
- **Inspiration, pas copie** : ni le nom, ni les textes, ni la marque des sites d'inspiration ne sont repris ; palette et contenus propres à ImmoPilot.

## D-059 — Le même style et les mêmes animations dans tout le logiciel
- **Date** : 2026-11-23 · **Statut** : Acceptée (demande du fondateur : « que tout le site soit animé comme ça », avec des animations pas trop longues)
- **Décision** :
  - **une seule palette** pour la page d'accueil et le logiciel : crème chaud, encre brune, terre cuite ; thème sombre « nuit » chaude ;
  - **barre latérale et menu mobile « nuit »** avec une lueur chaude, comme le haut de la page d'accueil ;
  - **titres en Sora**, mots mis en valeur en italique (Instrument Serif), boutons en pilule, cartes plus arrondies ;
  - **animations courtes**, adaptées à un outil utilisé toute la journée :
    - chaque page entre en une vague brève (340 ms, décalages de 40 ms, terminée en moins de 0,5 s) ;
    - les boutons s'enfoncent légèrement au clic ;
    - les messages apparaissent en douceur, le menu mobile s'ouvre en glissant, les barres de consommation se remplissent ;
    - les longues animations restent réservées à la page d'accueil.
- **Garde-fous** :
  - contrastes calculés (tous au-dessus de 4,5:1) puis vérifiés par l'audit d'accessibilité des 27 pages, en thèmes clair et sombre ;
  - animations coupées si l'utilisateur réduit les mouvements ;
  - aucune transformation ne reste appliquée une fois l'animation finie, ce qui évite les effets de bord sur la carte et les menus.

## D-060 — Menu simplifié : 7 entrées principales, outils et agence à part
- **Date** : 2026-11-23 · **Statut** : Acceptée (demande du fondateur : un outil simple à prendre en main, sans hésiter à retirer l'inutile)
- **Décision** :
  - **7 entrées pour le travail quotidien** : Accueil, Biens, Carte, Contacts, Agenda, Affaires, Agents ;
  - **« Outils »** : Estimations (ex-« Dossiers de biens »), Investissement (ex-« Investment Studio »), Tâches, Qualité des données ;
  - **« Agence »** : Équipe, Formule, Paramètres, puis Pilotage et Journal d'audit pour le gérant et les managers ;
  - noms en français courant ; la carte « Prochains modules » (en construction) est retirée de l'accueil, car elle n'aide pas l'agent.
- **Aucune fonction supprimée** : toutes les pages restent accessibles, seul le classement change.

## D-061 — Historique de chaque bien, tenu par la base
- **Date** : 2026-11-23 · **Statut** : Acceptée (demande du fondateur : savoir depuis quand une annonce existe, s'il y a des intéressés, des visites)
- **Décision** :
  - migration 0021 : la base note elle-même, par un déclencheur, la création du bien, chaque changement de prix, de statut et de mandat, avec l'auteur et la date ;
  - le site ne peut ni écrire, ni modifier, ni effacer cet historique, même le gérant ;
  - l'historique a la même visibilité que le bien ;
  - sur la fiche du bien, une section « Historique et activité » montre la durée en vente, l'évolution du prix, les acquéreurs de l'agence qui correspondent, les visites (avec l'intérêt exprimé), les affaires et une chronologie datée ;
  - on peut désormais modifier le prix d'un bien (avant, impossible après sa création) ; chaque modification est tracée dans le journal d'audit.
- **Limite** : cela concerne les biens de l'agence. Les annonces des autres agences attendent un fournisseur de données autorisé (voir `docs/research/fournisseurs-annonces.md`).

## D-062 — Récap de l'activité sur l'accueil (sans IA)
- **Date** : 2026-11-23 · **Statut** : Acceptée (demande du fondateur : « des récaps de ce qui s'est passé les dernières journées »)
- **Décision** :
  - en tête de l'accueil, « Le récap » montre ce qui s'est passé sur les dernières 24 heures ou les 7 derniers jours : ventes signées, biens vendus ou passés sous offre, offres, visites (intérêt fort), nouveaux biens et contacts, baisses de prix, tâches terminées ;
  - il montre aussi ce qui demande une action : tâches en retard, propositions d'agents à valider, mandats qui se terminent sous 30 jours ;
  - une phrase d'accroche résume les faits marquants, et chaque ligne mène à la page où agir ;
  - les chiffres sont comptés sous RLS : chacun voit le récap de ce qu'il a le droit de voir, et les éléments privés d'un collègue ne sont ni montrés ni comptés.
- **Suite** : quand la clé Anthropic sera là, l'IA pourra rédiger ce récap en quelques phrases, à partir de ces mêmes chiffres réels.

## D-063 — Assistant IA, quotas et plafond de dépenses
- **Date** : 2026-11-23 · **Statut** : Acceptée (demandes du fondateur : un chat IA pour aider les agents et répondre à leurs questions, des quotas pour éviter les abus et maîtriser le coût). Prêt, mais éteint tant que la clé Anthropic n'est pas ajoutée.
- **Décision** :
  - page « Assistant IA » et bouton « Besoin d'aide ? » sur toutes les pages du logiciel ;
  - l'assistant explique comment faire dans ImmoPilot (à partir du guide intégré) et répond sur les données de l'agence, telles que l'utilisateur les voit (biens, recherches d'acquéreurs anonymes, activité de la semaine) ;
  - **aucune donnée personnelle de contact n'est envoyée** à l'IA (ni nom, ni téléphone, ni e-mail) ;
  - modèle **Claude Haiku 5.5** (0,10 $ / 0,50 $ par million de jetons), réponses courtes, sans réflexion longue : quelques centièmes de centime par question ;
  - **trois garde-fous** :
    - le quota mensuel de la formule (échanges réussis de toute l'agence, comptés par la base) ;
    - un plafond de dépenses global (`AI_MONTHLY_BUDGET_USD`, 20 $ par défaut) ;
    - la lecture seule exclue ;
  - migration 0022 : `app.ai_runs` enregistre chaque appel (jetons, coût), jamais le texte. Personne ne peut modifier ni effacer un appel, sinon on pourrait remettre son quota à zéro.
- **Sans clé** : l'assistant est éteint et le dit ; le guide « Comment faire… » reste disponible.
- **À faire au passage en réel** : mentionner Anthropic comme sous-traitant dans la politique de confidentialité (partie légale) ; vérifier le premier appel réel (coût, qualité des réponses).

## D-064 — Agents automatiques : un passage par jour
- **Date** : 2026-11-23 · **Statut** : Acceptée (remarque du fondateur : « les agents ne fonctionnent pas encore »).
- **Constat** : les agents fonctionnaient (7 missions réussies en préproduction le 23/11), mais seulement quand on cliquait sur « Lancer », et l'agence de test n'avait ni bien ni contact : ils ne trouvaient donc rien.
- **Décision** :
  - chaque agent activé passe **tout seul une fois par jour**, à la première connexion de chaque utilisateur, **après** l'envoi de la page (aucune attente) ;
  - il agit avec les droits de cet utilisateur (la RLS s'applique, comme pour un lancement à la main) ; pas de compte « système » qui verrait tout ;
  - migration 0023 : `trigger` (`manuel` / `auto`) et `run_on` sur `app.missions`, avec un index unique (agence, agent, utilisateur, jour) : un seul passage automatique même si plusieurs onglets s'ouvrent ;
  - une fusion de doublons déjà proposée et en attente n'est plus reproposée ;
  - la page Agents dit clairement quand l'agence n'a encore rien à traiter, avec les liens pour ajouter ou importer biens et contacts.
- **Pourquoi pas une tâche planifiée (cron)** : il faudrait un secret supplémentaire à configurer dans Vercel et un compte qui voit toutes les agences. Le passage à la connexion suffit tant que les agents sont déterministes (coût nul) ; un cron pourra s'ajouter pour des agents qui doivent tourner la nuit.

## D-065 — Crédits IA à l'usage
- **Date** : 2026-11-23 · **Statut** : Acceptée (décisions du fondateur : « 2 € / 100 échanges », plafond « choisi par le gérant »).
- **Décision** :
  - au-delà des échanges IA inclus dans la formule, l'agence continue à l'usage : **2 € HT les 100 échanges** avec l'assistant, **0,20 € HT l'annonce** rédigée par IA ;
  - **plafond mensuel choisi par le gérant** (30 € par défaut, de 0 à 500 €, 0 = désactivé), dans « Formule » ; au-delà, l'IA s'arrête jusqu'au 1er du mois suivant, avec un message clair ;
  - réservé aux agences **abonnées par Stripe** (il faut un moyen de paiement) ; en essai, le quota reste un arrêt ;
  - le plafond de dépenses global de la plateforme (D-063) s'applique toujours ;
  - migration 0024 : le prix de chaque appel facturé est enregistré au moment de l'appel (`overage_cents`, seulement pour un appel réussi) ; `app.agency_ai_settings` (plafond, gérant seulement) ; `app.ai_overage` (total du mois, chiffres seulement) ;
  - facturation : au renouvellement, Stripe envoie `invoice.created` ; le webhook signé ajoute une ligne « Crédits IA au-delà du forfait » à la facture en brouillon (clé d'idempotence : jamais deux fois).
- **Coût pour nous** : environ 0,2 centime par échange (Haiku 5.5), soit une marge d'environ 90 %.
- **Reste à vérifier avec une vraie clé Stripe de test** : la ligne ajoutée à la facture (le code est testé avec des factures simulées, pas encore contre Stripe).

## D-066 — Diffusion des annonces : Pack annonce et suivi des portails
- **Date** : 2026-11-23 · **Statut** : Acceptée (décision du fondateur : « Pack maintenant + passerelle »).
- **Constat** : publier sur les portails depuis un logiciel est légal et habituel (la multidiffusion). Chaque portail reste payé par l'agence. L'envoi automatique demande un partenariat (passerelle comme Ubiflow, ou accord avec chaque portail).
- **Décision** :
  - **Pack annonce** sur la page « Annonce » : titre et description séparés, prêts à coller, et un fichier ZIP (texte et toutes les photos) ; disponible seulement quand les mentions obligatoires sont complètes ;
  - **suivi de la diffusion** : pour chaque portail (SeLoger, Leboncoin, Bien'ici, Logic-Immo, site de l'agence, autre), publié depuis quand, avec le lien (https seulement), ou retiré ;
  - **rappel de retrait** : quand un bien passe « vendu » ou « retiré » alors qu'il est encore en ligne, une tâche est créée pour son responsable (une seule ouverte à la fois) ;
  - migration 0025 : `app.property_portals`, même visibilité que le bien ; seuls ceux qui peuvent modifier le bien changent sa diffusion ; ni le bien ni le portail d'une ligne ne se modifient.
- **Suite** : demande de partenariat à une passerelle de multidiffusion (`docs/partenaires/multidiffusion-ubiflow.md`), puis envoi automatique.

## D-067 — Trouver des vendeurs : page publique « Estimez votre bien »
- **Date** : 2026-11-23 · **Statut** : Acceptée (le fondateur : « fais ce qui est mieux pour toi et dis-moi ce qui est mieux »).
- **Contexte** : le fondateur voulait voir sur la carte tous les biens de particuliers en vente, pour que les agences les contactent. Une agence n'achète presque jamais de biens : elle vend ceux des propriétaires, avec un mandat, contre des honoraires. Trouver des vendeurs (« rentrer des mandats ») est son besoin n° 1, et repérer les annonces de particuliers s'appelle la « pige ».
- **Ce qui l'empêche** : copier les annonces des portails sans accord est interdit (droit des bases de données, CPI L342-1 ; Jinka condamné face à SeLoger en 2025 et à Leboncoin en 2026). Et depuis le 11/08/2026, on ne peut plus démarcher un particulier par téléphone sans son accord préalable.
- **Décision** :
  - **page publique par agence** (`/estimer/<identifiant>`), fermée par défaut, ouverte par le gérant ou un manager, avec le membre qui reçoit les demandes ;
  - le propriétaire saisit adresse, type, surface et pièces, et obtient une **fourchette indicative à partir des ventes DVF** autour (arrondie au millier, avec le nombre de ventes et la date des données). Sans assez de ventes, aucune fourchette : un message invite à demander une estimation ;
  - il peut demander à être rappelé : **accord explicite par canal** (case e-mail, case téléphone), information sur l'usage des données ;
  - la demande crée dans l'agence un **contact « vendeur »** avec son consentement prouvé (date, page), un **bien « prospect »** (visible sur la carte) avec la fourchette montrée, et une **tâche de rappel** pour le destinataire ;
  - **protections** :
    - champ piège invisible et délai minimal de 3 secondes ;
    - 3 demandes par heure par connexion, 50 par jour par agence ;
    - empreinte de l'adresse IP seulement, jamais l'adresse elle-même ;
    - l'adresse et l'estimation sont recalculées côté serveur ;
  - migration 0026 : `app.agency_public_pages`, `app.public_lead_attempts`, et deux fonctions ouvertes au visiteur. Le rôle propriétaire n'est autorisé à créer que des lignes marquées « Estimation en ligne ».
- **Plus tard, si le fondateur le décide** : afficher les annonces de particuliers via un fournisseur sous licence (pige légale, payante), sans numéro de téléphone (devis : `docs/research/fournisseurs-annonces.md`).
- **À faire valider par l'avocat** : texte d'information RGPD de la page (l'agence est responsable du traitement, ImmoPilot sous-traitant) et durée de conservation.

## D-068 — Reprendre les biens de l'ancien logiciel (export Poliris)
- **Date** : 2026-11-23 · **Statut** : Acceptée (choix du fondateur : « Import auto des agences », pour que la carte se remplisse sans saisie).
- **Contexte** : les logiciels de transaction exportent les annonces de l'agence vers les portails au format SeLoger « Poliris » (ZIP contenant `Annonces.csv` : champs entre guillemets séparés par `!#`, un bien par ligne). Ce sont les propres annonces de l'agence : les reprendre est légal.
- **Décision** :
  - l'import des biens accepte, en plus du CSV Excel, ce **ZIP** (ou `Annonces.csv` seul) ; le format est reconnu automatiquement ;
  - champs repris (rangs de la spécification 4.09) : référence, adresse, code postal, ville, prix, surface, pièces, DPE, mandat exclusif, ascenseur, balcon ou terrasse, cave, parking, titre et texte de l'annonce ;
  - seules les **ventes d'appartements et de maisons** sont reprises (les autres lignes sont écartées avec la raison) ; les biens arrivent « sous mandat », adresse vérifiée par la Base Adresse Nationale, puis apparaissent sur la carte ;
  - les photos ne sont pas reprises (stockage limité, D-042), et seul `Annonces.csv` est extrait du ZIP (20 Mo au plus).
- **Suite** : synchronisation régulière (mise à jour des prix et retraits d'après les références), quand une passerelle ou une adresse de flux sera disponible.

## D-069 — Agents assistés par l'IA : annonces, analyse, relances, récap
- **Date** : 2026-11-24 · **Statut** : Acceptée (demande du fondateur : des agents « vraiment puissants », les quatre fonctions construites et testées une par une).
- **Décision** :
  - les 5 agents à règles restent (gratuits, fiables). Trois agents **assistés par l'IA** s'ajoutent, plus un récap rédigé :
    1. **Rédacteur d'annonces** (L2) : rédige titre et texte des biens en vente sans vraie description. Chaque annonce attend une **approbation** (texte visible dans « Approbations ») avant d'être enregistrée ; une proposition refusée n'est pas refaite avant 30 jours ;
    2. **Analyse des annonces** (L1) : points forts, points faibles, prix comparé aux ventes DVF du quartier, conseils. Envoyée au responsable sous forme de tâche, **une fois par prix** ;
    3. **Relances** (L1) : pour chaque alerte « bien correspondant », prépare le message à envoyer à l'acquéreur, ajouté à la tâche. **Rien n'est envoyé** ;
    4. **Récap rédigé** : bouton « Résumer avec l'IA » sur l'accueil, à partir des seuls chiffres du récap ;
  - le **code décide** de tout (quoi, combien, dans quel ordre) ; l'IA ne fait que rédiger ou analyser. 5 éléments au plus par passage, et l'agent s'arrête dès qu'un quota ou un plafond est atteint ;
  - **données envoyées** : caractéristiques du bien avec la **ville et le code postal seulement** (ni rue, ni numéro, ni notes), chiffres du marché, texte de l'annonce. Jamais un nom, un e-mail ou un téléphone de contact. Le message de relance commence par « Bonjour [Prénom] », la signature est ajoutée après ;
  - même modèle et mêmes garde-fous que l'assistant (D-063, D-065) : Haiku 5.5, quotas « annonces IA » (rédaction) et « échanges » (analyse, relances, récap), crédits à l'usage, plafond global ; coût de chaque mission mesuré ;
  - sans clé Anthropic, ces agents sont affichés mais éteints (« IA non activée ») et ne passent pas dans le tour quotidien.
- **Tests** : moteur (5 éléments au plus, approbation obligatoire, arrêt au quota), lecture des réponses, données envoyées. De bout en bout, `playwright.ia.config.ts` démarre le site avec un **faux serveur d'IA local** : même code d'appel qu'en ligne, sans appel réel ni coût. Le test vérifie aussi qu'aucune donnée de contact ne part et que la consommation est comptée.
- **À vérifier avec la vraie clé** : la qualité des textes rédigés par Haiku 5.5 (un modèle plus fort, Sonnet 5.5, reste possible par `AI_MODEL`).

## D-070 — Export des annonces au format SeLoger « Poliris »
- **Date** : 2026-11-26 · **Statut** : Acceptée (demande du fondateur : la publication automatique sur les portails, pour que les agences puissent quitter leur logiciel).
- **Décision** :
  - page « Biens », gérant et managers : « Envoyer aux portails » affiche le nombre d'annonces prêtes et à compléter, puis télécharge un **ZIP au format Poliris 4.09**. Il contient `Annonces.csv` (329 champs par annonce, entre guillemets, séparés par `!#`, fins de ligne CRLF, encodage Windows-1252), `Config.txt`, `Photos.cfg` (mode FULL) et les photos jointes ;
  - seuls les biens **sous mandat** dont les **mentions obligatoires** sont complètes partent. Le texte est celui de la fiche annonce, avec les mentions. L'adresse est transmise (placement du bien), comme le font les logiciels d'agence ; le portail décide de ce qu'il affiche ;
  - champs repris : référence (numéro de mandat, sinon identifiant), type, adresse, code postal, ville, prix, honoraires (pourcentage, à la charge de, prix hors honoraires), surface, pièces, titre, texte, équipements, exclusivité, DPE et GES, copropriété (lots, charges), photos ;
  - le fichier est **relu par l'import Poliris d'ImmoPilot** (test aller-retour) ; chaque export est journalisé.
- **Reste à faire pour l'envoi automatique** : obtenir l'identifiant agence et le mode d'envoi auprès du portail (partenariat éditeur) ou de la passerelle (Ubiflow, devis), et confirmer avec eux l'encodage attendu. E-mails prêts dans `docs/partenaires/multidiffusion-ubiflow.md`.
- **Coûts observés (26/11/2026)** : Ubiflow de 25 € HT/mois par portail à 135 € HT/mois par agence, plus l'installation, payés par l'agence. Partenariat direct avec un portail : généralement sans frais pour l'éditeur, à confirmer.
