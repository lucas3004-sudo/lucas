# ImmoPilot AI — Phase 0 : audit et cadrage

- **Date** : 20 novembre 2026
- **Auteur** : Claude (rôle CTO), à la demande du fondateur
- **Statut** : terminé, en attente des décisions du fondateur listées en section 9.3

> Les arbitrages de cette phase ont été produits en appliquant à la main le cycle de décision prévu pour les agents (proposition, objections du Devil's Advocate, décision motivée). Le système d'agents n'existe pas encore : aucun agent n'a « tourné » pour produire ce document.

---

## Synthèse

1. **Le dépôt est vide.** Il contient uniquement un `vercel.json` qui pointe vers un dossier `public/` absent. L'historique montre un ancien prototype (« CalcWidget », 4 calculateurs statiques), ajouté puis supprimé, qui n'est pas réutilisable. ImmoPilot AI part donc de zéro, ce qui permet de poser une architecture propre.
2. **Les données publiques françaises sont accessibles et ont été testées** : BAN, API Géo, Géorisques, DPE de l'ADEME, DVF et cadastre. Deux pièges ont été détectés : l'ancien répertoire DVF par commune sera supprimé fin novembre 2026, et l'API Adresse historique est en cours de décommissionnement.
3. **Le risque produit n°1 concerne les annonces immobilières.** Il n'existe aucune source gratuite et licite d'annonces en cours de vente. Les portails sont protégés par le droit des bases de données (jurisprudence Leboncoin). Le module Opportunity Finder dépend donc d'une décision commerciale, qui vous revient.
4. **Les agents doivent former une seule organisation, pas 130 programmes indépendants.** La liste du cahier des charges compte plus de 130 agents. Les exécuter tous comme des agents LLM autonomes serait coûteux, lent et incohérent. Je propose un moteur d'orchestration unique et un registre déclaratif d'agents, avec trois modes d'exécution : déterministe, assisté par IA, ou autonome.
5. **La roadmap est réordonnée.** Le socle d'agents est construit avant les outils professionnels. Un environnement de préproduction est déployé dès la fondation, au lieu d'attendre la phase 10. L'espace particuliers passe après la monétisation.

---

## 1. État actuel du projet

### 1.1 Contenu du dépôt

| Élément | Constat |
|---|---|
| Fichiers suivis | `vercel.json` uniquement : `{"outputDirectory": "public"}` |
| Historique | 3 commits du 27 mars 2026 : ajout de `calcwidget-vercel.zip`, ajout de `vercel.json`, suppression du zip |
| Branches | `main` et `claude/funny-newton-ef0awn`, identiques |
| Code applicatif | Aucun |
| Tests, CI, documentation | Aucun |

**Conséquence** : `vercel.json` fait référence à un dossier `public/` qui n'existe pas. Si un projet Vercel est relié à ce dépôt, il ne déploie rien d'utile. Je ne modifie pas ce fichier maintenant, parce qu'un projet Vercel externe pourrait en dépendre. Il sera remplacé en phase 3 (voir D-009).

### 1.2 Ancien prototype « CalcWidget » (archive supprimée, lue depuis l'historique git)

- Il s'agit de deux pages HTML statiques : une page d'accueil avec un générateur de widget, et un widget intégrable en iframe.
- Il propose 4 calculateurs : épargne, crédit, retraite, « loyer vs achat ».
- **Faille de sécurité** : les paramètres d'URL `titre`, `marque` et `color` sont injectés tels quels dans `innerHTML`. Un lien piégé peut donc exécuter du JavaScript (faille XSS).
- **Erreur de calcul** : le modèle « loyer vs achat » compare des loyers cumulés à des mensualités cumulées diminuées de 2 % du prix par an. Ce n'est pas un modèle « louer ou acheter » valide. Il ignore l'apport, les frais de notaire, la valeur de revente, le coût d'opportunité et la fiscalité.
- **Réutilisable** : seule la formule d'amortissement d'un prêt à mensualités constantes, qui est standard. Elle sera réécrite et testée dans le futur paquet de calculs financiers.

### 1.3 Environnement de développement (vérifié)

| Outil | Version |
|---|---|
| Node.js / npm / pnpm | 22.23 / 10.9 / 10.28 |
| Python | 3.13 |
| Docker | 29.10 (permet de lancer PostgreSQL et PostGIS en local) |
| Client PostgreSQL | 16.15 |
| Redis | 7.0 (disponible, mais non retenu au départ, voir D-005) |
| Machine | 4 cœurs, 15 Go de RAM |

**Réseau** : l'environnement cloud par défaut bloquait les API publiques. J'ai créé un environnement personnel **`lucas`**, réservé à ce dépôt, qui autorise uniquement les domaines suivants : `data.geopf.fr`, `api-adresse.data.gouv.fr`, `geo.api.gouv.fr`, `georisques.gouv.fr`, `data.ademe.fr`, `files.data.gouv.fr`, `static.data.gouv.fr`, `www.data.gouv.fr`, `apicarto.ign.fr`, `cadastre.data.gouv.fr`, `apidf-preprod.cerema.fr` et `geo-dvf.s3.sbg.io.cloud.ovh.net`. Les registres de paquets (npm, PyPI) restent ouverts.

---

## 2. Fonctionnalités existantes

**Aucune fonctionnalité d'ImmoPilot AI n'existe.** Les 20 pages et les 16 livrables du cahier des charges sont tous à construire.

| Module | Existant |
|---|---|
| Overview, Dashboard, Analytics | Non |
| Opportunity Finder, Property Intelligence, Market Intelligence | Non |
| CRM, Smart Matching, Calendar, Transactions, Documents | Non |
| Investment Studio | Non (l'ancien calculateur de crédit n'est pas réutilisable en l'état) |
| AI Copilot, Agent Center, Agent Council | Non |
| Espace particuliers | Non |
| Billing, Integrations, Settings, Administration | Non |
| Authentification, organisations, rôles, base de données, backend | Non |

---

## 3. Éléments manquants

### 3.1 Techniques
Tout le socle est à construire : backend, base de données, authentification, gestion multi-organisations, design system, files de tâches, orchestrateur d'agents, intégrations de données, tests, CI/CD, hébergement et monitoring.

### 3.2 Comptes et accès (ils engagent de l'argent ou des comptes externes, donc ils nécessitent votre accord)

| Besoin | Nécessaire à partir de | Pourquoi |
|---|---|---|
| Clé API Anthropic avec un plafond de dépense | Phase 5 (premiers agents IA) | Aucun agent LLM ne peut fonctionner sans elle |
| Hébergement (application, worker, PostgreSQL, stockage) | Fin de phase 3 (préproduction) | Mise en ligne |
| Source d'annonces sous licence | Phase 6 (Opportunity Finder) | Voir section 4.3 |
| Stripe | Phase 8 | Abonnements |
| Nom de domaine, e-mail transactionnel | Phase 3 et 6 | Invitations, alertes |
| Clé INSEE (api.insee.fr) | Phase 4, optionnel | Données socio-démographiques (aussi disponibles en fichiers) |

### 3.3 Juridiques (avant toute commercialisation)
- CGU et CGV, politique de confidentialité, mentions légales.
- Accord de sous-traitance RGPD (DPA, art. 28) avec les clients, liste des sous-traitants ultérieurs (hébergeur, Anthropic, Stripe, etc.).
- Validation par un avocat des points signalés en section 7.2 : loi Hoguet, prospection, AI Act.

---

## 4. Sources de données : résultats des tests

Tous les tests ont été réalisés le 20/11/2026 depuis cet environnement. Ils sont reproductibles avec `./scripts/check-data-sources.sh`.

### 4.1 Tableau de synthèse

| Source | Usage dans ImmoPilot | Licence / accès | Test | Constats |
|---|---|---|---|---|
| **BAN, géocodage Géoplateforme** (`data.geopf.fr/geocodage`) | Normaliser une adresse, obtenir les coordonnées et le code INSEE | Ouverte, sans clé | OK, 0,7 s | À utiliser à la place de `api-adresse.data.gouv.fr`, transférée à l'IGN et en cours de décommissionnement (elle répond encore aujourd'hui) |
| **API Géo** (`geo.api.gouv.fr`) | Communes, codes postaux, population | Ouverte | OK, 1 s | — |
| **Géorisques** (`georisques.gouv.fr/api/v1`) | Risques par commune (GASPAR) et rapport par coordonnées | Ouverte | OK, 0,4 s | Le rapport par adresse distingue le statut de la commune et celui de l'adresse : il faut afficher les deux |
| **DPE ADEME** (`data.ademe.fr`, jeu `dpe03existant`) | Classe énergie, consommation, caractéristiques du logement | Licence Ouverte 2.0 | OK, 0,5 s | **16 003 705 DPE** depuis juillet 2021, mis à jour le 18/11/2026. Adresses déjà rapprochées de la BAN. Coefficient électricité passé de 2,3 à 1,9 au 01/01/2026 : un DPE antérieur peut ne plus refléter la classe actuelle |
| **DVF géolocalisées**, fichiers nationaux (`static.data.gouv.fr`) | Transactions réelles, comparables, prix au m² | Licence Ouverte, avec conditions DGFiP (voir 4.2) | OK (en-tête lu) | Couverture de juillet 2021 à juin 2026, mise à jour semestrielle. L'URL change à chaque livraison : il faut la lire dans les métadonnées data.gouv |
| DVF par commune (`files.data.gouv.fr/geo-dvf`) | — | — | OK aujourd'hui | **Marqué « [ARCHIVE] », suppression annoncée fin novembre 2026** (la page indique « 31/11/2026 »). À ne pas utiliser |
| **API Carto cadastre (IGN)** | Parcelles, surface du terrain | Ouverte | OK, 2 à 5 s | Lente : prévoir un cache |
| Cadastre Etalab (fichiers) | Contours des parcelles en masse | Licence Ouverte | OK | Alternative en fichiers à l'API Carto |
| Cerema DVF+ (`apidf-preprod.cerema.fr`) | DVF enrichies | — | **ÉCHEC** (connexion réinitialisée, 2 tentatives) | Service de préproduction : on n'en dépend pas |
| INSEE (`api.insee.fr`) | Revenus, démographie | Compte et clé requis | Non testé | Phase 4. Les fichiers Filosofi et la Base permanente des équipements (BPE) sont téléchargeables sans clé |
| Transports (`transport.data.gouv.fr`, GTFS) et équipements (BPE) | Proximité des services | Ouverte | Non testé | Phase 4 |

### 4.2 DVF : contraintes à intégrer dès la conception

- **Couverture incomplète.** Le Bas-Rhin, le Haut-Rhin et la Moselle (régime du Livre foncier) ainsi que Mayotte ne sont pas couverts. Vérification : le fichier de Strasbourg 2025 renvoie une erreur 404. Le produit doit l'indiquer explicitement au lieu d'afficher « aucune vente ».
- **Une vente occupe plusieurs lignes.** Exemple mesuré à Amiens en 2025 : 5 439 lignes. Une médiane brute calculée sans regrouper les lignes par `id_mutation` donne 2 944 €/m² pour les appartements. **Ce chiffre n'est pas fiable** : une même vente portant sur plusieurs lots, ou un appartement vendu avec une dépendance, fausse le prix au m². Un pipeline de nettoyage est indispensable (regroupement par mutation, exclusion des ventes multi-biens ambiguës, filtres sur les valeurs aberrantes, distinction maison / appartement). Il sera testé unitairement.
- **Conditions de réutilisation DGFiP** (fiche data.gouv) :
  1. Interdiction de réidentifier les personnes (art. R112 A-3 du Livre des procédures fiscales). Il est donc interdit de croiser les ventes DVF avec les contacts du CRM pour identifier des vendeurs.
  2. Les données ne doivent pas être indexées par les moteurs de recherche externes. **Toute page affichant des transactions DVF doit être réservée aux utilisateurs connectés ou marquée `noindex`.** Cela limite directement la stratégie SEO de l'espace particuliers.
- **Délai de publication** : environ 6 mois, par livraisons semestrielles. Le produit doit afficher la date de fraîcheur des données.

### 4.3 Annonces immobilières : il n'existe pas de source gratuite et licite

- Aucun grand portail (Leboncoin, SeLoger, Bien'ici, PAP) n'offre d'API publique de lecture des annonces. Les « passerelles » servent aux agences à **publier** leurs propres annonces, pas à lire celles des autres.
- **Jurisprudence** : un site d'annonces est une base de données protégée par le droit *sui generis* du producteur. LBC contre Entreparticuliers : CA Paris, 2 février 2021, n° 17/17688, puis Cass. 1re civ., 5 octobre 2022, n° 21-16.307. Le but poursuivi par l'extraction n'a pas d'incidence sur l'atteinte. Les nombreux « scrapers » disponibles sur des places de marché n'ont donc aucune valeur juridique pour nous.
- **Options licites** :
  1. **Les données de l'agence elle-même** : ses mandats, saisis dans ImmoPilot ou importés depuis son logiciel de transaction (export XML ou CSV).
  2. **Un agrégateur sous licence payante**, par exemple Stream Estate : API par clé, webhooks pour les nouvelles annonces et les baisses de prix. Point d'attention : la v1 de son API s'arrête le 31/12/2026, il faudra viser la v2. **Avant tout contrat, il faut vérifier contractuellement la chaîne de droits** de l'agrégateur sur les annonces qu'il redistribue.
  3. **Saisie par l'utilisateur** d'une annonce qu'il consulte : caractéristiques recopiées ou texte collé, sans extraction automatique.
- **Conséquence** : l'Opportunity Finder démarrera sur les options 1 et 3. Il sera branché sur l'option 2 seulement après votre accord, puisque l'abonnement a un coût.

---

## 5. Architecture recommandée

### 5.1 Principes
- **Un monolithe modulaire plutôt que des microservices.** Une seule base de code TypeScript, découpée en paquets aux frontières nettes. Elle pourra être scindée plus tard si le besoin est démontré.
- **PostgreSQL au centre.** Il porte les données métier, la géographie (PostGIS), la file de tâches (pg-boss), la mémoire organisationnelle et l'isolation des clients (Row-Level Security). Cela fait moins de services à opérer pour une petite équipe.
- **Des calculs déterministes, testés, séparés de l'IA.** Les rendements, le cash-flow, les scores, le nettoyage DVF et le matching sont des fonctions pures testées unitairement. L'IA explique et rédige, mais ne calcule jamais un chiffre financier elle-même.
- **Chaque donnée affichée porte sa provenance** : source, date, et statut parmi « vérifiée », « déclarée », « estimée », « hypothèse » ou « manquante ».

### 5.2 Vue d'ensemble

```
                    ┌───────────────────────────────────────────────┐
 Navigateur  ─────► │ apps/web — Next.js (UI + API REST /api/v1)    │
 (pro, investisseur,│  • auth (Better Auth, organisations, rôles)   │
  particulier,      │  • validation zod, contrôle d'accès, quotas   │
  admin)            └──────────────┬────────────────────────────────┘
                                   │ SQL (RLS : org courante par transaction)
                    ┌──────────────▼────────────────────────────────┐
                    │ PostgreSQL 16 + PostGIS (+ pgvector plus tard)│
                    │  données métier · journaux · mémoire · files  │
                    └──────────────▲────────────────────────────────┘
                                   │ pg-boss (jobs, cron, retries)
                    ┌──────────────┴────────────────────────────────┐
                    │ apps/worker — Node.js                         │
                    │  • orchestrateur d'agents (API Claude)        │
                    │  • ingestion DVF / DPE, alertes, rapports PDF │
                    └──────┬───────────────────────┬────────────────┘
                           │                       │
              ┌────────────▼──────────┐   ┌────────▼─────────────────┐
              │ packages/integrations │   │ Stockage objet S3 (UE)   │
              │ BAN · DVF · ADEME ·   │   │ documents, rapports      │
              │ Géorisques · cadastre │   └──────────────────────────┘
              └───────────────────────┘
```

### 5.3 Choix techniques

| Domaine | Choix | Justification | Alternatives écartées |
|---|---|---|---|
| Langage | TypeScript, de bout en bout | Un seul langage du front aux agents. Le SDK Anthropic officiel existe en TypeScript | Python côté agents : il imposerait deux langages et deux chaînes d'outils |
| Monorepo | pnpm workspaces + Turborepo | Paquets partagés (domaine, base de données, UI) et builds incrémentaux | Plusieurs dépôts : trop lourd |
| Front + API | Next.js (App Router), React, Tailwind, composants Radix | Rendu serveur rapide, API REST dans le même déploiement, écosystème mature | API séparée (NestJS) : surcoût injustifié au départ |
| Base de données | PostgreSQL 16 + PostGIS | Recherche par rayon, comparables géographiques, transactions fiables | MongoDB : pas de géospatial relationnel ni de RLS |
| ORM / migrations | Drizzle | SQL explicite, gestion des politiques RLS, types PostGIS | Prisma : RLS et PostGIS plus difficiles |
| Multi-tenant | Schéma partagé, `org_id` sur chaque table client, **RLS PostgreSQL forcée** et contrôle applicatif | Défense en profondeur : un oubli dans le code ne suffit pas à faire fuiter des données d'un autre client | Une base par client : exploitation trop lourde au démarrage |
| Authentification | Better Auth (auto-hébergé) | Organisations, invitations, rôles, 2FA, sessions en base. Données en Europe, pas de dépendance à un service américain | Clerk et Auth0 : payants, données hors UE |
| Files, scheduler, workers | pg-boss dans un processus worker séparé | Reprises, priorités, délais, tâches planifiées (cron), sans Redis | BullMQ + Redis : à adopter si le volume l'exige (voir D-005) |
| Agents IA | Orchestrateur maison sur l'API Messages d'Anthropic + Tool Runner du SDK, exécuté dans le worker | Permissions, budgets, journaux et isolation par client sous notre contrôle, dans notre base | Managed Agents (bêta) : voir D-004 |
| Modèles | Haiku 5.5 (routage, classification), Sonnet 5.5 (analyse, rédaction), Opus 5.5 (arbitrages du CEO) | Coût adapté à la complexité, voir 6.8 | Un seul gros modèle pour tout : trop cher |
| Cartographie | MapLibre GL + fonds IGN (Géoplateforme) | Gratuit, français, sous licence ouverte | Google Maps : coût à l'usage |
| Rapports PDF | Gabarits HTML rendus en PDF par Chromium (Playwright) dans le worker | Même design system que l'application | Génération PDF bas niveau : pénible à maintenir |
| Stockage de documents | Compatible S3, hébergé en UE, URLs signées, préfixe par organisation | Standard, interchangeable | — |
| Tests | Vitest (unitaires), Playwright (bout en bout), tests d'isolation entre clients dédiés | Exigence de la partie 13 | — |
| Observabilité | Logs structurés (pino), tables de suivi des agents, Sentry UE en préproduction | Coûts et erreurs visibles dès le début | — |
| Secrets | Variables d'environnement de l'hébergeur, `.env.example` sans valeurs, jamais de secrets dans git | — | — |
| Facturation | Stripe Billing, en phase 8 | Abonnements et usage mesuré | — |
| Hébergement | **À décider avec vous** (voir 9.3) | A : Vercel + hébergeur de worker + PostgreSQL managé en UE. B : tout en France (Scaleway, Clever Cloud…), argument de souveraineté auprès des agences | — |

### 5.4 Modèle de données (premier découpage, détaillé en phase 2)

- **Identité et clients** : `organizations`, `users`, `memberships` (rôle par organisation), `invitations`, `sessions`, `audit_log`.
- **Référentiel immobilier, partagé et public** : `addresses`, `parcels`, `dvf_mutations`, `dvf_mutation_lines`, `dpe_records`, `risk_reports`, `market_stats` (par commune et type de bien), `data_source_runs` (fraîcheur des données).
- **Données client, isolées par RLS** : `properties`, `listings`, `contacts`, `buyer_profiles`, `seller_profiles`, `deals` (pipeline), `activities`, `appointments`, `tasks`, `documents`, `saved_searches`, `alerts`, `matches`, `investment_scenarios`, `reports`.
- **Agents** : `agent_definitions`, `agent_runs`, `agent_steps`, `agent_artifacts`, `approvals`, `budgets`, `usage_ledger`.
- **Gouvernance (organisation entreprise)** : `proposals`, `reviews`, `objections`, `decisions`, `experiments`, `memory_entries`.

---

## 6. Organisation multi-agents proposée

### 6.1 Constat critique : plus de 130 agents listés
Exécuter chaque agent comme un agent LLM autonome multiplierait les coûts, la latence et les risques d'incohérence. Beaucoup de ces « agents » ont une tâche parfaitement déterministe. Par exemple, le Rental Yield Agent est une formule, le Duplicate Contact Detection Agent un algorithme de rapprochement, le Price Change Monitor une tâche planifiée.

**Proposition** : un **moteur unique** et un **registre déclaratif**. Chaque agent est une fiche : mission, département, responsable, outils autorisés, niveau de permission, modèle, budget, critères de validation. Chaque fiche déclare aussi l'un des trois **modes d'exécution** :

| Mode | Fonctionnement | Exemples | Coût |
|---|---|---|---|
| **Déterministe** | Code testé, sans LLM | Rental Yield, Cash Flow, Financing Simulation, Duplicate Contact Detection, Price Change Monitor, Deadline Monitoring, Document Checklist, Comparable Sales (sélection DVF) | Quasi nul |
| **Assisté par IA** | Un appel LLM, ou un enchaînement fixe, sur des données préparées par le code | Listing Copywriter, Property Report Writer, Matching Explanation, Lead Qualification, Email Drafting | Faible |
| **Autonome** | Boucle LLM avec outils : l'agent choisit ses appels dans un budget borné | CEO, directeurs, Devil's Advocate, AI Copilot, Market Research, Negotiation Preparation | Maîtrisé par le budget |

Tous les agents, y compris les déterministes, reçoivent des missions, produisent un livrable, sont journalisés et apparaissent dans l'Agent Center avec un badge indiquant leur mode. Le mot « agent » reste honnête : l'utilisateur sait ce qui est calculé et ce qui est généré par l'IA.

### 6.2 Deux organisations distinctes

| | **Organisation Produit** | **Organisation Entreprise** |
|---|---|---|
| Sert | Les clients (agents, agences, investisseurs, particuliers) | L'exploitant du SaaS (vous) |
| Départements | 3.1 à 3.9 : Immobilier Intelligence, Opportunités, Property, CRM, Matching, Investissement, Copilot, Marketing immobilier, Transactions | Direction (CEO, CTO, CFO…), Devil's Advocate, 3.10 à 3.14 : UX, Développement, Qualité et sécurité, Croissance, Support |
| Données | Celles de l'organisation cliente uniquement (RLS) | **Aucune donnée personnelle des clients.** Uniquement des métriques agrégées et anonymisées, et les retours explicitement partagés |
| Interface | Copilot, modules, Agent Center de l'organisation | Espace Administration, Agent Council, mémoire organisationnelle |
| Actions | Dans le périmètre de l'utilisateur, validées par lui | Propositions, analyses, tickets. **Aucun déploiement ni changement en production sans validation humaine** |

Cette séparation est une exigence RGPD : un agent « Churn Analysis » ou « Competitor Research » n'a pas à lire le CRM d'une agence.

**Le rôle du CEO Agent** : il dirige l'Organisation Entreprise et supervise les deux organisations au niveau des indicateurs (taux d'échec, coûts, qualité, file d'arbitrages). Il ne se trouve **pas** sur le chemin de chaque demande d'utilisateur. Un routeur léger (Haiku 5.5) envoie directement la mission au directeur concerné. Le CEO intervient pour les missions qui touchent plusieurs départements, les conflits, les décisions stratégiques et le Council.

### 6.3 Circuit d'une mission (Organisation Produit)

```
Utilisateur ─► Routeur (Haiku) ─► Directeur du département (plan + découpage)
                                     ├─► Agent spécialisé A ─┐  (en parallèle seulement
                                     ├─► Agent spécialisé B ─┤   si les tâches sont
                                     └─► Agent spécialisé C ─┘   indépendantes)
                                     ◄── consolidation
                        Contrôles QA automatiques (sources présentes, chiffres
                        cohérents avec les calculs, mentions obligatoires, budget)
                                     ─► Livrable + journal + coût mesuré
```

Les petites tâches (« calcule le rendement de ce bien ») vont directement à l'agent concerné, sans passer par un directeur.

### 6.4 Cycle de décision (Organisation Entreprise)

C'est une machine à états persistée en base, une proposition par fonctionnalité importante :

1. `brouillon` : un agent ou vous identifiez un besoin et rédigez une proposition structurée (problème, utilisateurs, valeur, preuves, coût estimé).
2. `en revue`, avec des **revues en parallèle** puisqu'elles sont indépendantes : Product Director (valeur), CTO (faisabilité), CFO (coût et marge), Compliance (risques), responsables concernés.
3. `contre-expertise` : le **Devil's Advocate** reçoit la proposition et les revues. Il produit des objections numérotées, chacune avec sa gravité, sa preuve et sa recommandation (accepter, modifier, reporter, refuser, expérimenter).
4. `arbitrage` : le **CEO** (Opus 5.5) produit une décision structurée. **Chaque objection reçoit une réponse explicite** (acceptée ou rejetée, avec justification). Le système refuse une décision qui laisse une objection sans réponse.
5. Si la proposition est acceptée, des tâches sont créées, exécutées, contrôlées par la QA, puis un rapport est envoyé au CEO.

**Garde-fous** : un seul tour de réplique entre le proposant et le Devil's Advocate, un budget maximal par proposition, puis arbitrage obligatoire. Le Devil's Advocate a ses propres instructions, il ne voit pas le raisonnement interne du proposant (seulement la proposition et les preuves), il peut tourner sur un modèle différent pour diversifier les angles, et il est évalué sur la **justesse** de ses objections a posteriori, pas sur leur nombre.

### 6.5 Fiche d'un agent (registre)

```yaml
id: property-valuation
nom: Property Valuation Agent
organisation: produit
departement: property-intelligence
responsable: property-analysis-director
mode: assiste            # deterministe | assiste | autonome
modele: sonnet-5.5        # aucun en mode déterministe
outils: [dvf.comparables, dpe.lookup, geo.risks, finance.price_range]
donnees: org_courante     # org_courante | referentiel_public | agrege_anonyme | aucune
permission_max: L1        # voir 6.6
budget: { tokens_par_run: 40000, runs_par_jour_org: 200 }
validation:
  - toutes les valeurs chiffrées proviennent d'un outil (pas de chiffre inventé)
  - fourchette + niveau de confiance + sources datées
  - mention « estimation indicative, pas une expertise »
```

### 6.6 Permissions et gouvernance

| Niveau | Exemples | Validation |
|---|---|---|
| L0 lecture | Consulter DVF, lire un dossier | Automatique |
| L1 écriture interne réversible | Créer une note, un brouillon de rapport, une tâche | Automatique, journalisée |
| L2 modification importante | Fusionner des contacts, modifier des données en masse, changer un pipeline | Validation par l'utilisateur ou le directeur |
| L3 externe, financier ou irréversible | Envoyer un e-mail ou un SMS, publier une annonce, engager une dépense, supprimer, toucher à la sécurité | **Validation humaine obligatoire** (boîte « Approbations ») |

- Un agent ne peut pas modifier ses propres règles, ses permissions ou celles d'un autre département.
- Les textes externes (annonces, e-mails reçus, documents importés) sont traités comme des **données, jamais comme des instructions**, pour contrer l'injection de prompts.
- Un interrupteur d'arrêt existe par agent, par organisation et au niveau global.

### 6.7 Mémoire organisationnelle

- Elle est structurée en tables : décisions, propositions acceptées et refusées (avec les raisons), objections, incidents, objectifs, état des tâches, expérimentations.
- Elle est consultée **à la demande** via un outil `memory.search` (recherche plein texte PostgreSQL, puis recherche vectorielle si nécessaire). Elle n'est jamais injectée en entier dans un prompt.
- Les sorties longues sont résumées. Les résultats vérifiés sont réutilisés : par exemple, les comparables DVF d'une commune sont mis en cache jusqu'à la livraison DVF suivante.
- Le système apprend des retours (un livrable noté utile ou non, une objection confirmée ou non) par des **statistiques et des exemples**. Il ne modifie jamais ses règles ou ses permissions sans validation humaine.

### 6.8 Coûts estimés

**Ce sont des estimations, pas des mesures.** Elles sont calculées au tarif public de l'API Anthropic en USD au 20/11/2026, par million de tokens : Haiku 5.5 à 0,10 $ en entrée et 0,50 $ en sortie, Sonnet 5.5 à 2 $ et 10 $, Opus 5.5 à 4 $ et 20 $. La lecture depuis le cache coûte environ un dixième du prix d'entrée, et l'API Batch réduit le coût de 50 %. Les coûts réels seront mesurés et affichés séparément à partir de la phase 5.

| Opération | Modèle | Volume supposé | Coût estimé |
|---|---|---|---|
| Routage d'une demande | Haiku 5.5 | 2 k tokens en entrée, 0,1 k en sortie | ≈ 0,0003 $ |
| Rédaction d'annonce | Sonnet 5.5 | 4 k / 1 k | ≈ 0,02 $ |
| Dossier d'analyse d'un bien | Sonnet 5.5 | 20 k / 3 k | ≈ 0,07 $ |
| Échange avec le Copilot (2 à 3 outils) | Sonnet 5.5 | 3 requêtes, cache partiel | ≈ 0,03 à 0,08 $ |
| Agent Council complet | 6 avis Sonnet + Devil's Advocate et CEO sur Opus | ≈ 60 k / 9 k | ≈ 0,30 $ |
| Explications nocturnes de 1 000 opportunités | Haiku 5.5 en Batch | 1,5 k / 0,2 k chacune | ≈ 0,13 $ |

**Ordre de grandeur pour un utilisateur Pro actif** (200 échanges Copilot, 40 dossiers, 30 annonces et des alertes par mois) : **15 à 20 $ par mois de coût IA**, soit environ 10 à 13 % d'un abonnement à 149 €. C'est viable, à condition d'appliquer des quotas par formule. Ces hypothèses seront vérifiées par le CFO Agent à partir des mesures réelles.

---

## 7. Risques

### 7.1 Techniques et produit

| Risque | Impact | Mesures |
|---|---|---|
| Pas de source licite d'annonces en cours de vente | **Élevé** : l'Opportunity Finder est limité | Données de l'agence, import, saisie, puis agrégateur sous licence après accord (4.3) |
| Périmètre énorme pour une équipe réduite : tout faire à moitié | Élevé | Tranches verticales complètes, une à la fois, avec critères d'acceptation et tests ; pas de bouton sans action |
| Estimation de prix peu fiable avec les seules données publiques (pas d'annonces, DVF avec 6 mois de retard, état du bien inconnu) | Élevé | Fourchette plutôt que prix unique, niveau de confiance, nombre de comparables affiché, mention « indicative », possibilité d'ajuster par l'agent |
| Erreurs de données DVF (ventes multi-lots, valeurs aberrantes) | Moyen | Pipeline de nettoyage testé, exclusions documentées |
| Hallucinations du LLM | Élevé | Chiffres fournis uniquement par les outils, sources obligatoires, contrôles QA automatiques, « donnée manquante » affichée explicitement |
| Explosion des coûts IA (boucles d'agents) | Moyen | Budgets par exécution, par organisation et global ; nombre d'étapes maximal ; modèles adaptés ; cache ; Batch |
| Fuite de données entre clients | Critique | RLS forcée, tests d'isolation automatisés dans la CI, journal d'accès |
| Injection de prompts via les annonces, e-mails ou documents | Élevé | Contenu externe traité comme donnée, actions L3 soumises à validation humaine, outils limités par agent |
| Instabilité des API publiques (exemples réels : migration de la BAN, suppression du répertoire DVF par commune) | Moyen | Couche d'adaptateurs par source, `check-data-sources.sh` exécuté régulièrement, cache local des référentiels |
| Concurrence : les CRM installés (Hektor dès environ 79 € HT/mois, Apimo dès 89 €/mois, Modelo ex-Netty) ajoutent de l'IA ; les acteurs de la donnée (Yanport, PriceHubble) ont un historique d'annonces et lancent des agents IA | Élevé | Différenciation par l'automatisation multi-agents transparente et sourcée, et par l'import depuis les outils existants (voir 9.2, question stratégique) |

### 7.2 Réglementaires

**Ceci n'est pas un avis juridique.** Ces points sont à faire valider par un avocat avant la commercialisation.

| Sujet | Risque pour ImmoPilot | Mesures prévues |
|---|---|---|
| **RGPD** | Le CRM contient des données personnelles. L'agence est responsable de traitement, ImmoPilot est sous-traitant | DPA (art. 28), hébergement en UE, registre des traitements, durées de conservation, export et suppression par contact, journal d'accès, minimisation des données envoyées au LLM (pseudonymisation des contacts quand c'est possible), garanties de transfert vers Anthropic (DPA, clauses types) à vérifier |
| **Prospection téléphonique** | **Depuis le 11/08/2026**, le démarchage téléphonique des consommateurs exige leur consentement préalable (loi n° 2025-594 du 30/06/2025, art. L223-1 du Code de la consommation). La « pige » classique par appels à froid devient risquée | Le Lead Acquisition Agent ne lance aucun démarchage. Enregistrement de la preuve et de la date du consentement par contact, blocage des actions sans consentement |
| **Prospection par e-mail ou SMS** | Consentement préalable requis pour les particuliers (art. L34-5 du CPCE) | Même mécanisme de consentement. Envois en niveau L3 |
| **DVF** | Interdiction de réidentification, pas d'indexation par les moteurs de recherche | Pages DVF réservées aux utilisateurs connectés ou en `noindex`, aucun croisement DVF × CRM pour identifier un vendeur |
| **Bases de données des portails** | Droit *sui generis* (jurisprudence Leboncoin) | Aucun scraping (D-002) |
| **AI Act, article 50** (applicable depuis le 02/08/2026) | En tant que fournisseur du système Copilot, informer que l'on échange avec une IA. Marquage lisible par machine des contenus générés (art. 50(2)) : pertinent pour les annonces rédigées par IA. Le sursis jusqu'au 02/12/2026 ne vaut que pour les systèmes déjà sur le marché avant le 02/08/2026 | Mention IA dans le Copilot, métadonnées « généré par IA » sur les contenus produits, analyse juridique en phase 1 |
| **Scoring de personnes** | Évaluer la solvabilité de personnes physiques relève des systèmes d'IA « à haut risque » (annexe III de l'AI Act). Le scoring des prospects relève du profilage (RGPD) | Le simulateur de budget reste un outil de simulation utilisé par l'utilisateur, pas une notation de crédit. Le lead scoring est expliqué, et jamais seul fondement d'une décision |
| **Discrimination au logement** | Critères de matching ou de « style de vie » discriminatoires (art. 225-1 du Code pénal) | Liste fermée de critères autorisés, aucun critère protégé, revue par le Compliance Director |
| **Loi Hoguet** | La mise en relation de particuliers avec des agences contre rémunération pourrait relever de l'entremise immobilière | **Question à soumettre à un avocat** avant de monétiser l'espace particuliers |
| **Conseil en investissement et fiscalité** | Ne pas fournir de conseil financier ou fiscal personnalisé (statut CIF) | Simulations génériques, hypothèses affichées, mentions explicites, aucune recommandation d'achat personnalisée |
| **Annonces** | Pratiques commerciales trompeuses, mentions obligatoires (DPE, honoraires…) | Le Listing Copywriter ne modifie jamais les caractéristiques du bien. Contrôle automatique des mentions obligatoires (liste à confirmer en phase 1) |
| **DPE 2026** | Un DPE antérieur au 01/01/2026 peut ne plus correspondre à la classe actuelle d'un logement chauffé à l'électricité. Calendrier d'interdiction de location : G depuis 2025, F en 2028, E en 2034 | Affichage de la date du DPE, alerte sur un reclassement possible, règles de gel des loyers et d'interdiction intégrées au simulateur |

---

## 8. Roadmap de développement

### 8.1 Modifications par rapport à votre plan

| Changement | Raison |
|---|---|
| Le socle d'agents (moteur, registre, journaux, budgets, approbations) passe **avant** les outils professionnels | Tous les modules l'utilisent. Le construire après obligerait à tout réécrire |
| L'organisation entreprise complète (CEO, directeurs, Council, Devil's Advocate) vient **après** les premiers modules utiles aux clients | Le Council a besoin de sujets réels, de mesures et d'une mémoire alimentée |
| L'espace particuliers passe **après** la monétisation | Le B2C exige un budget d'acquisition. Les contraintes DVF (`noindex`) et la question Hoguet doivent être levées d'abord |
| La préproduction est déployée **dès la phase 3**, puis à chaque phase | Ne pas découvrir les problèmes de déploiement en phase 10 |
| La qualité et la sécurité deviennent **continues** (tests à chaque phase), avec un audit formel en phase 9 | Règle « jamais terminé sans test » |

### 8.2 Plan

| Phase | Contenu | Livrable vérifiable |
|---|---|---|
| **0. Audit** ✅ | Ce document, décisions, test des sources | `docs/phase-0-audit.md`, `scripts/check-data-sources.sh` |
| **1. Recherche et stratégie** | Matrice concurrentielle sourcée, besoins des agents (entretiens si possible), choix de la stratégie d'annonces, liste des mentions obligatoires, analyse de l'AI Act, hypothèses de prix et de quotas, périmètre du MVP | `docs/phase-1-strategie.md` validé par vous |
| **2. Architecture détaillée** | Modèle de données complet, matrice des permissions, spécification du moteur d'agents, conventions d'API, environnements | Documents de conception et ADR |
| **3. Fondation** | Monorepo, CI, PostgreSQL + PostGIS + RLS, Better Auth (organisations, rôles), design system, coque applicative, journal d'audit, **préproduction en ligne** | Tests d'isolation entre clients au vert, connexion et invitation fonctionnelles |
| **4. Intelligence immobilière** | Ingestion et nettoyage DVF, DPE, Géorisques, cadastre. **Dossier de bien depuis une adresse** : comparables, prix au m², fourchette indicative avec confiance, risques, DPE, sources datées. Statistiques de marché par commune | Un dossier réel généré pour n'importe quelle adresse couverte, export PDF |
| **5. Socle agents** | Moteur, registre, routeur, journaux, budgets, file d'approbations, Agent Center v1. Premiers agents IA branchés sur la phase 4 (Report Writer, explications) | Coûts réels mesurés et affichés, tests des permissions |
| **6. Outils professionnels** | CRM, Smart Matching (pondérations modifiables, explications), Investment Studio, AI Copilot, Documents, Transactions, Calendar, Opportunity Finder v1 (données de l'agence, imports, saisies) | Parcours complet : prospect → profil acheteur → matching → visite → compte rendu |
| **7. Organisation entreprise** | CEO, direction, directeurs, Devil's Advocate, Agent Council, mémoire organisationnelle, cycle de décision | Une proposition réelle passe tout le cycle avec une décision motivée |
| **8. Monétisation** | Stripe, formules, quotas, facturation, page Billing | Abonnement de test de bout en bout |
| **9. Qualité et sécurité** | Audit de sécurité, tests de charge, accessibilité, documentation utilisateur | Rapport d'audit, corrections |
| **10. Espace particuliers** | Recherche, carte, favoris, alertes, comparateur, simulateurs, mise en relation | Parcours particulier → agence |
| **11. Production** | Hébergement définitif, sauvegardes testées (restauration), monitoring, domaines, procédure de maintenance | Mise en production |

**MVP commercialisable** (fin de la phase 6) : pour les agents indépendants et les petites agences, dossier de bien sourcé et estimation argumentée, CRM, matching, Investment Studio et Copilot, en formule Solo ou Pro.

---

## 9. Premières tâches à exécuter

### 9.1 Phase 1 (je peux la mener sans attendre)
1. **Matrice concurrentielle** : Hektor, Apimo, Modelo, Yanport, PriceHubble, Casafari, outils des réseaux de mandataires. Fonctionnalités, prix publics, place de l'IA, sources citées.
2. **Inventaire des données complémentaires** : INSEE (Filosofi, BPE), transport.data.gouv, Géoplateforme (fonds de carte). Tests ajoutés au script de vérification.
3. **Fiche juridique** : mentions obligatoires des annonces, AI Act art. 50, consentement en prospection, questions pour l'avocat (Hoguet, statut CIF).
4. **Hypothèses de prix et de quotas** par formule, reliées aux coûts estimés en 6.8.
5. **Périmètre exact du MVP** et critères d'acceptation de chaque fonctionnalité.

### 9.2 Question stratégique à trancher en phase 1
Les agences sont liées à leur logiciel de transaction, qui assure notamment la **multidiffusion vers les portails**. ImmoPilot ne l'aura pas au début. **Recommandation préliminaire** : se positionner d'abord comme le copilote d'analyse et d'automatisation **à côté** de l'outil existant (import des mandats et contacts), avec un CRM complet pour les indépendants. On viserait le remplacement complet plus tard. *Objection du Devil's Advocate : un positionnement « complément » réduit le prix acceptable. Réponse : à vérifier par des entretiens en phase 1.*

### 9.3 Décisions qui vous reviennent (argent, comptes ou données sensibles)

| # | Décision | Quand | Ma recommandation |
|---|---|---|---|
| 1 | Créer une clé API Anthropic avec un plafond de dépense mensuel | Avant la phase 5 | Plafond de 50 $/mois pendant le développement |
| 2 | Évaluer un agrégateur d'annonces payant (devis, vérification des droits) | Phase 1 (évaluation), phase 6 (contrat) | Demander des devis, sans s'engager |
| 3 | Hébergement : Vercel + services UE, ou 100 % hébergeur français | Fin de phase 3 | Hébergement français (argument de souveraineté auprès des agences). À confirmer après comparaison des coûts |
| 4 | 3 à 5 agents immobiliers pour des entretiens ou une bêta | Phase 1 | Fortement conseillé |
| 5 | Consultation d'un avocat (RGPD, Hoguet, AI Act, CGU) | Avant la commercialisation | Indispensable |

---

## Sources consultées (20/11/2026)

- Données testées directement : data.geopf.fr, geo.api.gouv.fr, georisques.gouv.fr, data.ademe.fr, data.gouv.fr (API et fichiers DVF), apicarto.ign.fr, cadastre.data.gouv.fr.
- [Transfert de l'API Adresse à l'IGN (data.gouv.fr)](https://www.data.gouv.fr/fr/posts/lapi-adresse-de-la-base-adresse-nationale-est-transferee-a-lign-10/)
- [Fiche DVF (data.gouv.fr)](https://www.data.gouv.fr/fr/datasets/5c4ae55a634f4117716d5656/) et [question écrite AN n° 42638](https://questions.assemblee-nationale.fr/dyn/15/questions/QANR5L15QE42638.pdf)
- [Arrêt Leboncoin, droit sui generis (CMS)](https://cms.law/en/fra/news-information/arret-leboncoin-web-scraping-droit-sui-generis-sur-les-bases-de-donnees), [Cass. 1re civ. 5 oct. 2022 (Dalloz)](https://www.dalloz-actualite.fr/document/civ-1re-5-oct-2022-fs-b-n-21-16307)
- [CNIL : prospection téléphonique](https://cnil.fr/fr/prospection-commerciale-par-telephone-hors-automate-dappel-quelles-sont-les-regles), [DGCCRF : règles du démarchage](https://economie.gouv.fr/dgccrf/les-fiches-pratiques/les-regles-du-demarchage-telephonique-simposant-aux-entreprises)
- [AI Act art. 50 (Stibbe)](https://www.stibbe.com/publications-and-insights/the-ai-acts-transparency-obligations-rules-scope-and-timeline), [lignes directrices (DLA Piper)](https://www.dlapiper.com/insights/publications/2026/08/the-eus-new-guidelines-on-ai-transparency)
- [Nouveau DPE au 1er janvier 2026 (economie.gouv.fr)](https://www.economie.gouv.fr/actualites/un-nouveau-dpe-au-1er-janvier-2026-pour-favoriser-le-chauffage-electrique)
- [Comparatif CRM immobiliers 2026 (Hackceleration)](https://hackceleration.com/fr/labs/meilleur/crm-immobilier), [PriceHubble, suite d'agents IA](https://www.pricehubble.com/fr/pricehubble-news/suite-agents-ia), [Yanport (La Fabrique du Net)](https://www.lafabriquedunet.fr/logiciel/yanport)
- [Stream Estate, serveur MCP et API](https://raw.githubusercontent.com/streamestate/mcp-server/HEAD/README.md)
- Tarifs de l'API Anthropic : référence officielle du SDK (cache du 03/11/2026)
