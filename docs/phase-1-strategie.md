# ImmoPilot AI — phase 1 : stratégie, prix et périmètre du MVP

- **Date** : 20 novembre 2026
- **Statut** : proposition, **en attente des choix du fondateur** (prix, cible prioritaire)
- **Documents de recherche** :
  - [Concurrents](research/concurrents.md)
  - [Fournisseurs d'annonces](research/fournisseurs-annonces.md)
  - [Données complémentaires](research/donnees-complementaires.md)
  - [Fiche juridique](legal/fiche-juridique.md)
  - [Guide d'entretien](research/guide-entretien.md)

## 1. Positionnement recommandé

> **« L'équipe d'assistants IA de l'agent immobilier indépendant : elle prépare vos rendez-vous avec des données officielles sourcées, rapproche vos biens et vos acheteurs, simule les investissements et rédige à votre place. Elle fonctionne à côté de votre logiciel actuel. »**

**Pourquoi ce positionnement :**
- **Les indépendants et les mandataires sont mal servis.** Les offres multi-agents (PriceHubble) sont sur devis et visent les grands comptes. Les CRM installés ajoutent l'IA de façon inégale.
- **Nous ne gagnerons pas sur la donnée d'annonces.** Yanport, PriceHubble et Casafari en ont l'historique. Notre force sera l'automatisation, l'explication sourcée et le prix.
- **Nous ne remplacerons pas la multidiffusion au lancement.** D'où le choix « à côté de » l'outil existant, avec import des biens et des contacts.

**Devil's Advocate** : *les mandataires de réseau (iad, Safti, Capifrance…) reçoivent souvent des outils de leur réseau, parfois gratuits, voire Yanport via un partenariat dans le cas d'iad. Le marché réel est peut-être plus étroit qu'il n'y paraît.*
**Réponse** : c'est un vrai risque. Les entretiens (H5, H6) et le premier mois de bêta le mesureront. Les petites agences restent la cible de repli.

## 2. Prix et quotas

### 2.1 Coûts unitaires d'IA (estimations, voir l'audit section 6.8)

Taux de change retenu : 1 $ = 1 €, à ajuster.

| Opération | Coût estimé |
|---|---|
| Dossier d'analyse d'un bien | 0,07 $ |
| Échange avec le Copilot | 0,05 $ (moyenne) |
| Annonce rédigée | 0,02 $ |
| Compte rendu ou e-mail | 0,01 $ |
| Explication d'une correspondance bien / acheteur (Haiku) | 0,001 $ |

### 2.2 Grilles comparées

Prix HT par mois. Le coût IA « maximal » suppose que tous les quotas sont épuisés. Le coût « moyen » suppose 40 % d'utilisation, une hypothèse à mesurer.

| Formule | **Option A : prix d'entrée (recommandée)** | Option B : hypothèse initiale | Quotas mensuels proposés | Coût IA max / moyen | Part du prix (option A) |
|---|---|---|---|---|---|
| **Investisseur** | 19 € | — | 10 dossiers, 50 échanges Copilot, Investment Studio illimité | 3,2 $ / 1,3 $ | 17 % / 7 % |
| **Solo** (1 utilisateur) | **59 €** | 79 € | 40 dossiers, 200 échanges, 30 annonces, 1 000 contacts | 13,9 $ / 5,6 $ | 24 % / 9 % |
| **Pro** (1 utilisateur) | **99 €** | 149 € | 100 dossiers, 500 échanges, 80 annonces, 5 000 contacts, PDF à votre marque | 34,6 $ / 13,8 $ | 35 % / 14 % |
| **Agency** (3 utilisateurs, puis 49 € par utilisateur supplémentaire) | **249 €** | 299 € | Quotas partagés : 250 dossiers, 1 200 échanges, 200 annonces, contacts illimités, rôles | 83,5 $ / 33,4 $ | 34 % / 13 % |
| **Business** (réseaux) | Sur devis | Sur devis | API, SSO, quotas négociés | — | — |
| **Particulier** | Gratuit (phase 10) | — | Limité | — | — |

**Lecture** : avec l'option A, le coût IA moyen représente 7 à 14 % du prix. Après hébergement, paiements, support et données, la marge brute visée est d'environ 70 % au lancement. Elle s'améliorera avec le cache, l'API Batch et le routage vers Haiku pour les échanges simples.

**Pourquoi recommander l'option A plutôt que B** :
- à 149 €, l'offre Pro **sans multidiffusion** coûterait plus cher qu'Apimo « CRM AI+ » (139 €), qui est un logiciel complet ;
- Yanport Agent 360 coûte 39 € HT par utilisateur ;
- pour un nouvel entrant, il faut d'abord prouver la valeur. Les prix pourront monter avec les fonctions.

**Devil's Advocate** : *un prix bas attire des clients exigeants et rend la marge fragile si l'usage dépasse 40 %.*
**Réponse** :
- les quotas sont plafonnés, avec des packs supplémentaires payants : le coût maximal reste sous contrôle ;
- le CFO Agent suivra la marge réelle par formule dès la phase 5 ;
- **aucune formule ne sera vendue avant que ses fonctions existent** (règle de la partie 9).

**Coûts fixes à prévoir** (ordre de grandeur, à confirmer avec le choix de l'hébergeur) :
- hébergement de préproduction et de production ;
- fournisseur d'annonces éventuel (dès 99 €/mois chez Stream Estate, sous réserve de la vérification juridique) ;
- avocat (prestation ponctuelle avant le lancement).

## 3. Périmètre du MVP (fin de la phase 6)

Chaque fonction a des critères d'acceptation **vérifiables**. Elle n'est terminée que si ses tests automatiques passent.

| # | Fonction | Critères d'acceptation principaux |
|---|---|---|
| F1 | **Comptes, organisations, rôles** | Inscription, création d'organisation, invitation, rôles (propriétaire, agent, lecture seule). **Un test automatique prouve, pour chaque table, qu'un utilisateur de l'organisation A ne peut ni lire ni modifier les données de l'organisation B.** Journal d'audit des connexions et des actions sensibles |
| F2 | **Dossier de bien depuis une adresse** | Adresse géocodée par la BAN. Comparables DVF nettoyés dans un rayon réglable, avec leur nombre, la médiane et l'intervalle du prix au m². DPE trouvés à l'adresse, avec leur date. Risques Géorisques. Zone ABC. Loyer ANIL avec son intervalle. **Chaque valeur affiche sa source et sa date.** En Alsace-Moselle, un message explicite « DVF non disponible ». Export PDF identique à l'écran |
| F3 | **Estimation indicative** | Toujours une **fourchette** (jamais un prix unique) et un niveau de confiance (élevé, moyen ou faible) calculé à partir du nombre et de la dispersion des comparables. Ajustements de l'agent tracés. Mention « estimation indicative, pas une expertise ». Calcul testé sur des jeux de données de référence |
| F4 | **CRM** | Contacts (acquéreurs, vendeurs, investisseurs), profils de recherche, pipeline, notes, tâches et rappels, rendez-vous (export calendrier .ics). **Champ consentement** (canal, date, preuve). Détection des doublons. Import CSV. Export et suppression d'un contact (droits RGPD) |
| F5 | **Biens de l'agence** | Saisie, import CSV, photos. Statut (mandat, sous offre, vendu) |
| F6 | **Smart Matching** | Score de 0 à 100 par paire bien / acheteur. **Pondérations modifiables.** Explication des critères remplis et manquants. Liste fermée de critères, sans aucun critère discriminatoire. Calcul testé |
| F7 | **Investment Studio** | Rendement brut et net, cash-flow, mensualité de prêt, frais d'acquisition, travaux, charges, vacance, sensibilité au prix et au loyer. **Toutes les hypothèses sont modifiables et affichées.** Résultats vérifiés sur au moins 10 cas calculés à la main. Mention « simulation, pas un conseil » |
| F8 | **AI Copilot** | Questions en langage naturel sur les biens, contacts et dossiers de l'utilisateur. Appels d'outils réels. **Mention visible « vous échangez avec une IA ».** Cite ses sources. Répond « donnée manquante » plutôt que d'inventer. Toute action externe passe par la file d'approbation |
| F9 | **Rédaction assistée** | Annonce avec **contrôle automatique des mentions obligatoires**, compte rendu de visite, e-mail de relance, préparation de rendez-vous vendeur. Contenus **marqués « générés par IA »**. Rien n'est envoyé ni publié sans validation |
| F10 | **Agent Center v1** | Liste des agents, avec leur mode (déterministe, assisté ou autonome), leur statut, leurs dernières missions et leur **coût réel mesuré**. Boîte d'approbations |
| F11 | **Opportunity Finder v1** | Recherches enregistrées sur les biens de l'agence et les biens importés. Alerte quand un nouveau bien correspond à un acheteur. Branchement d'un fournisseur d'annonces seulement après sa validation juridique |
| F12 | **Transactions (version légère)** | Étapes du compromis à l'acte, liste de pièces par étape, alertes d'échéance |

**Hors MVP** : espace particuliers (phase 10), organisation entreprise et Agent Council (phase 7), facturation Stripe (phase 8, **avant toute vente**), multidiffusion vers les portails, application mobile native (le site sera responsive).

### 3.1 Agents réellement actifs dans le MVP (registre v1)

| Département | Agent | Mode |
|---|---|---|
| Transverse | Routeur de missions | Assisté (Haiku) |
| Property Intelligence | Property Analysis Director | Autonome (budget borné) |
| | Comparable Sales Agent | Déterministe |
| | Property Valuation Agent | Déterministe + explication assistée |
| | DPE Analysis Agent | Déterministe |
| | Property Risk Agent (Géorisques) | Déterministe |
| | Property Report Writer | Assisté |
| Investissement | Rental Yield Agent, Cash Flow Agent, Financing Simulation Agent | Déterministes |
| Smart Matching | Buyer-Property Matching Agent | Déterministe |
| | Matching Explanation Agent | Assisté (Haiku) |
| CRM | Duplicate Contact Detection Agent | Déterministe |
| | Follow-up Agent | Assisté (envois en L3) |
| Assistant | General Real Estate Assistant (Copilot) | Autonome |
| | Appointment Preparation Agent, Listing Copywriter | Assistés |
| Transactions | Document Checklist Agent, Deadline Monitoring Agent | Déterministes |

Cela fait **19 agents réels au MVP.** Les autres agents du cahier des charges sont ajoutés au fil des phases, chacun avec sa fiche, ses tests et son tableau de coûts.

## 4. Indicateurs de réussite du MVP (bêta)
- Préparer un dossier vendeur complet prend **moins de 5 minutes**, contre la durée relevée en entretien (H1).
- Au moins **3 utilisateurs bêta actifs chaque semaine** pendant 4 semaines.
- **Zéro chiffre inventé** : chaque valeur affichée provient d'une source ou d'un calcul tracé (contrôle QA automatique).
- **Coût IA moyen inférieur à 15 %** du prix de la formule visée, mesuré.

## 5. Prochaine étape : phase 2 (architecture détaillée)
- Modèle de données complet, matrice des permissions (rôles × actions × niveaux L0 à L3).
- Spécification du moteur d'agents : fiche, cycle de vie, budgets, journaux, approbations.
- Pipeline d'ingestion : DVF, DPE, loyers, zonage, BPE, avec nouvelles tentatives et cache.
- Conventions d'API, environnements (local, préproduction, production), stratégie de tests.

## Sources
Voir les documents de recherche liés en tête de page.
