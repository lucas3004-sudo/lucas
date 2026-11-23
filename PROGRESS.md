# Progression — ImmoPilot AI

Dernière mise à jour : 2026-11-20

Règle : une fonctionnalité n'est marquée terminée que si elle est testée et que ses critères
d'acceptation sont vérifiés.

## État des phases

| Phase | Statut | Livrables |
|---|---|---|
| 0. Audit | ✅ Terminée (2026-11-20) | [Audit](docs/phase-0-audit.md), [Décisions](docs/DECISIONS.md), [Script de vérification des sources](scripts/check-data-sources.sh) |
| 1. Recherche et stratégie | ✅ Terminée (2026-11-20) : prix d'entrée et cible « petites agences » choisis par le fondateur | [Stratégie, prix, MVP](docs/phase-1-strategie.md), [Concurrents](docs/research/concurrents.md), [Fournisseurs d'annonces](docs/research/fournisseurs-annonces.md), [Données complémentaires](docs/research/donnees-complementaires.md), [Fiche juridique](docs/legal/fiche-juridique.md), [Guide d'entretien](docs/research/guide-entretien.md) |
| 2. Architecture détaillée | ✅ Terminée (2026-11-20) | [Architecture](docs/phase-2/architecture.md), [Modèle de données](docs/phase-2/modele-donnees.md), [Permissions](docs/phase-2/permissions.md), [Moteur d'agents](docs/phase-2/moteur-agents.md), [Ingestion](docs/phase-2/ingestion.md) ; prototypes [RLS](prototypes/rls/run.sh) (12 tests sur 12) et [nettoyage DVF](prototypes/dvf/clean_dvf.py) |
| 3. Fondation (+ préproduction) | ✅ Fondation livrée, testée (CI au vert), fusionnée dans `main`. Base de préproduction Supabase prête et testée. ⏸️ **Mise en ligne Vercel en attente d'un réglage par le fondateur, depuis un ordinateur** | [Design system](docs/design-system.md), [captures](docs/captures/), code dans `apps/web` et `packages/db` |
| 4. Intelligence immobilière | ✅ Dossier de bien livré et testé (2026-11-20) ; données publiques chargées en préproduction le 2026-11-23 (Somme pour DVF, France entière pour loyers et zonage) | [Phase 4](docs/phase-4-dossier-de-bien.md), [capture](docs/captures/08-dossier-de-bien.png) |
| 5. Socle agents | 🟡 **Socle sans IA livré et testé (2026-11-21)** : fiches versionnées, passerelle d'outils, missions, approbations, Agent Center, 5 agents déterministes. Reste : modes IA, Copilot, worker (clé Anthropic nécessaire) | [Socle des agents](docs/phase-5-socle-agents.md) |
| 6. Outils professionnels (fin du MVP) | 🟡 **CRM et matching livrés et testés (2026-11-20)**, avancés avant la phase 5 (choix du fondateur, D-034). **Investment Studio**, **tableau de bord du gérant**, **agenda (.ics)**, **export RGPD** et **import CSV**, **alertes de correspondance**, **suivi des affaires** et **fiche annonce** (mentions obligatoires, sans IA) et **photos des biens** livrés et testés. Phase 6 terminée côté outils, hors IA | [CRM et matching](docs/crm-et-matching.md), [Investment Studio](docs/investment-studio.md), [Pilotage](docs/pilotage-gerant.md), [Affaires](docs/affaires.md), [Annonce](docs/annonce.md), [captures 09 à 15](docs/captures/) |
| 7. Organisation entreprise (CEO, Council, Devil's Advocate) | À faire | — |
| 8. Monétisation | En cours : formules et quotas (2026-11-21) ; essai de 14 jours et paiement Stripe prêts (2026-11-23), en attente de la clé de test | [Formules et quotas](docs/formules-et-quotas.md) |
| 9. Qualité et sécurité (audit formel) | En cours : audit automatique d'accessibilité WCAG 2.1 AA en CI (2026-11-21) ; CSP stricte, contrôle de version de la base | [Accessibilité](docs/accessibilite.md) |
| 10. Espace particuliers | À faire | — |
| 11. Production | À faire | — |

## Fonctionnalités opérationnelles (testées)
**Formules et quotas (sans paiement)** : formule de chaque agence (Essai par défaut), consommation comptée sur toute l'agence, ajout refusé au quota avec un message clair, page « Formule et consommation » ([détails](docs/formules-et-quotas.md), D-048).

**Agents (sans IA)** : Agent Center avec 5 agents déterministes (qualité des données, Opportunity Finder, veille des échéances, veille des mandats, détection des doublons) ; passerelle d'outils qui refuse tout ce qui dépasse la fiche ; boîte d'approbations (aucune fusion sans décision humaine).

**Sécurité du compte** : double authentification par application (TOTP) avec codes de secours, essais limités, rappel au gérant et aux managers ([détails](docs/securite-compte.md)).

**Application (phase 3)** :
- **Comptes** : inscription, connexion, déconnexion. Mot de passe de 12 caractères minimum. Limitation des tentatives (429 constaté).
- **Agences** : création (le créateur devient gérant), choix de l'agence active.
- **Équipe** : invitation par lien (7 jours), acceptation, changement de rôle, retrait.
  - Règles testées : un manager ne nomme jamais de gérant, l'agence garde toujours un gérant.
- **Paramètres** : nom de l'agence (gérant seulement), visibilité par défaut (gérant et managers). Enregistrés sous RLS.
- **Journal d'audit** : ajout seul, lecture réservée au gérant et aux managers.
- **Isolation entre agences** dans la base (RLS), avec un garde-fou automatique « aucune table oubliée ».
- **Design** : thème clair et sombre, affichage mobile, navigation limitée aux modules construits.

**Tests** (tous au vert le 2026-11-21) :
- 188 tests unitaires (domaine, formules et quotas, comptes rendus de visite, mandats, matching, doublons, simulation d'investissement sur 12 cas calculés à la main, intégrations, rôles, garde-fous), plus 1 test de référence sur le vrai fichier DVF ;
- 43 tests d'intégration sur PostgreSQL (isolation, dossiers immuables, CRM, réattribution, rendez-vous, affaires, photos, agents, formules et consommation, comptes rendus de visite, mandats, abonnements) ;
- 35 scénarios de bout en bout (Playwright), dont 5 pour l'accessibilité (27 pages, thèmes clair et sombre, mobile, clavier, contrôle positif), 10 pour le CRM, le matching, les alertes, le pilotage et les affaires, 3 pour les en-têtes de sécurité et l'état de santé, et 1 chacun pour les agents et les approbations, l'import CSV, l'annonce et les photos, la double authentification, l'Investment Studio, les formules et quotas, le compte rendu de visite, le suivi des mandats, l'export de l'agence et la carte des biens ;
- lint, types, build de production.

**Dossier de bien (phase 4)** :
- adresse BAN ;
- ventes comparables DVF nettoyées ;
- estimation en fourchette avec niveau de confiance ;
- loyer ANIL, DPE ADEME, risques Géorisques (commune et adresse), zonage ABC ;
- provenance affichée sur chaque bloc ;
- instantané immuable, impression PDF.

Testé sur une vraie adresse d'Amiens : 82 comparables, 114 000 à 169 000 €.

**CRM et matching (phase 6, première partie)** :
- contacts avec visibilité privé / agence, détection des doublons avant création ;
- consentements de prospection par canal, avec preuve, en ajout seul ;
- profils de recherche (communes par code postal), biens de l'agence (adresse BAN) ;
- matching de chaque bien avec **tous** les profils actifs de l'agence : score expliqué, pondérations modifiables, acquéreur privé d'un collègue anonymisé, bouton « Prévenir » qui crée une tâche ;
- tâches (échéance, retard, faite) ; journal d'audit sans donnée personnelle ;
- agenda : rendez-vous en heure de Paris, liés à un contact ou à un bien, export calendrier (.ics) ;
- export des données d'un contact (droit d'accès RGPD), journalisé ;
- import CSV des contacts et des biens (Excel accepté), avec aperçu, doublons écartés, adresses vérifiées par la BAN ;
- alertes automatiques : un nouveau bien prévient les collègues dont un acquéreur correspond à 75 % ou plus (Opportunity Finder v1) ;
- affaires de l'offre à l'acte : étapes, échéances (délai de rétractation calculé), pièces par étape, statut du bien synchronisé ;
- accueil « Ma journée » : tâches en retard et du jour, rendez-vous d'aujourd'hui et de demain, échéances d'affaires à 7 jours, biens signalés ;
- qualité des données : consentements manquants, doublons probables, annonces et biens incomplets, échéances dépassées, profils trop larges, contacts sans coordonnées ;
- photos des biens : galerie de 15 photos, réduites dans le navigateur, revérifiées par le serveur (JPEG ou PNG, métadonnées et GPS retirés) ;
- page d'accueil publique, essai gratuit de 14 jours, page « Abonnement » et paiement Stripe (prêt, activé dès la clé de test), blocage après l'essai sans perte de données ([détails](docs/abonnements.md)) ;
- carte des biens v2 : moteur vectoriel MapLibre sur fond IGN épuré, vue satellite, biens regroupés, recherche de lieu et rayon, critères complets, cartes à photo ; fiche du bien avec carrousel et analyse du marché chiffrée (verdict, fourchette, rendement, risques) ([détails](docs/carte-des-biens.md), captures [16](docs/captures/16-carte.jpg) et [17](docs/captures/17-fiche-du-bien.jpg)) ;
- export complet de l'agence : 8 fichiers CSV pour Excel, réservé au gérant avec double authentification, formules neutralisées, journalisé ([détails](docs/export-agence.md)) ;
- suivi des mandats : numéro unique dans l'agence, dates, rappel 30 jours avant la fin dans « Ma journée », mandats expirés dans « Qualité des données », reprise par l'import CSV ([détails](docs/suivi-mandats.md)) ;
- compte rendu de visite : texte prêt à envoyer au vendeur, sans IA et sans le nom des visiteurs, synthèse des visites sur la fiche du bien ([détails](docs/compte-rendu-visite.md)) ;
- fiche annonce : contrôle des mentions obligatoires (DPE, dépenses d'énergie, copropriété, honoraires, barème, Géorisques), copie bloquée s'il en manque une, texte produit sans IA.

**Investment Studio** : rendement brut et net, cash-flow, mensualité, intérêts, sensibilité au prix et au loyer ; toutes les hypothèses modifiables ; accessible depuis un bien ou un dossier ; mention « simulation, pas un conseil ».

**Pilotage du gérant** : activité mesurée par membre sur 7, 30 ou 90 jours, sans classement ; portefeuille par statut ; biens sans acquéreur correspondant ; relances en retard. Réservé au gérant et aux managers.

**Outils** :
- le script de vérification des sources (15 sources, dont 7 critiques) ;
- le prototype d'isolation entre agences : `sudo ./prototypes/rls/run.sh` (12 tests sur 12, PostgreSQL 16.15) ;
- le prototype de nettoyage DVF : `python3 -I prototypes/dvf/clean_dvf.py <fichier.csv>`.

## Résultats mesurés (phase 2)
- **Isolation** : aucune lecture, écriture, modification ni suppression possible d'une agence à l'autre, même avec un contexte d'agence erroné. Le mode session fuit (d'où son interdiction). Comptage de 100 003 lignes sous RLS : 8 à 17 ms.
- **DVF Amiens 2025** : 5 439 lignes, soit 2 305 ventes. Médiane des appartements anciens : 2 470 €/m² après nettoyage, contre 2 963 €/m² en calcul naïf (+20 %).
- **DPE** : rapprochement par identifiant BAN, 5 sur 5 identiques. Adresse témoin sans DPE, donc statut « manquante ».

## Vérifié
- [x] Sources critiques : BAN, API Géo, Géorisques (GASPAR et rapport), DPE ADEME, métadonnées et fichier national DVF. Lancer `./scripts/check-data-sources.sh` (sortie 0 le 2026-11-20 à 15:20 UTC).
- [x] Sources complémentaires : loyers ANIL 2025 (Amiens : 13,40 €/m², intervalle 11,00 à 16,33 €), zonage ABC (Amiens : B1), transport.data.gouv (816 jeux), fond de carte IGN, BPE INSEE 2025.
- [x] Couverture DVF : Alsace-Moselle absente (404 sur Strasbourg).
- [x] Coupures ponctuelles constatées (Géorisques, static.data.gouv.fr) : le script fait désormais 2 nouvelles tentatives.
- [ ] Cerema DVF+ : injoignable. Non bloquant, non retenu.

## Lacunes connues (à combler avant de vraies agences)
- **Photos stockées en base** (D-042) : environ 100 à 150 biens illustrés dans l'offre gratuite de Supabase. Il faudra un stockage d'objets avant la production (accord du fondateur nécessaire).
- **Vérification de l'adresse e-mail** et envoi des invitations par e-mail : nécessitent un service d'e-mail, donc un compte externe (D-023).
- **Double authentification** : construite et testée (D-043), mais seulement rappelée au gérant et aux managers. Elle devra devenir obligatoire avant la production, avec une procédure de récupération par e-mail (Brevo).
- ~~CSP sans nonces~~ : **corrigé le 2026-11-21** (CSP à nonce par requête, D-045).

## Décisions en attente du fondateur
Le travail qui ne dépendait de personne est fait (point du 2026-11-21). Ce qui suit demande une action ou un accord du fondateur, du plus urgent au moins urgent.

1. **Mise en ligne (Vercel)** : ✅ faite le 2026-11-22 par le fondateur (dossier `apps/web`, variables collées, déploiement « Ready », `/api/health` à « ok »). Reste à faire : déconnecter le second projet Vercel « saas », qui échoue à chaque modification (https://vercel.com/lucasblaevoet30-7777s-projects/saas/settings/git).

2. **Compte Brevo** (e-mails), choisi le 2026-11-20. Il permettra la vérification des adresses, l'envoi des invitations et la récupération de compte, nécessaire pour rendre la double authentification obligatoire (D-043).
3. **Valider trois hypothèses de quotas** (D-048) : Investisseur avec 100 contacts et 1 membre, quotas de l'Essai, « 1 utilisateur » en Solo et Pro. Ces valeurs sont modifiables en une ligne.
4. **Clé API Anthropic** : **reportée** (« rien dépenser pour l'instant », D-047). Le compte est gratuit, avec des crédits d'essai, et un plafond mensuel arrête l'IA quand il est atteint. Elle débloquera le Copilot et la rédaction par IA.
5. **Stockage des photos avant la production** (D-042) : un stockage d'objets sera nécessaire au-delà d'environ 100 à 150 biens illustrés (compte ou offre selon le volume).
6. Demandes de devis aux fournisseurs d'annonces : **reportées** (choix du fondateur).
7. Entretiens avec 1 ou 2 agents ou gérants d'agence (guide prêt dans `docs/research/guide-entretien.md`).
8. Consultation d'un avocat avant la commercialisation (questions prêtes dans `docs/legal/fiche-juridique.md`, dont la liste des mentions d'annonce et l'information des salariés sur le pilotage).

Décidé le 2026-11-20 : prix d'entrée (D-014), cible « petites agences » (D-015), lancement de la phase 2. Le 2026-11-20 : autorisation permanente de fusionner et d'appliquer les migrations testées (CLAUDE.md).

## Journal
- **2026-11-23, abonnements** : page d'accueil publique, essai de 14 jours, page « Abonnement », paiement Stripe et réception de ses événements (migration 0020) ; en attente de la clé de test Stripe.
- **2026-11-23, carte v2 et fiche du bien** : à la demande du fondateur (D-055). Décisions du fondateur : IA activée pour l'analyse des annonces (D-056), paiement Stripe avec 14 jours d'essai (D-057) ; comptes Stripe et Anthropic à créer par lui.
- **2026-11-23, données publiques en préproduction et carte des biens** :
  - chargement depuis GitHub (bouton « Ingestion préproduction ») : 34 875 communes zonées, 139 600 loyers, 16 156 ventes DVF de la Somme (janvier 2024 à juin 2026) ; médiane des appartements à Amiens : 2 527 €/m² ;
  - carte des biens gratuite (D-054).
- **2026-11-22, mise en ligne (Vercel)** : réglages faits par le fondateur ; construction réussie ; `/api/health` répond « ok » avec 19 migrations sur 19. L'inscription échouait sur l'adresse du déploiement (origine refusée) : corrigé (D-053).
- **2026-11-21, agent « Veille des mandats »** : 5e agent déterministe (L1). Il crée un rappel pour le responsable de chaque mandat qui se termine dans 30 jours ou a expiré, sans doublon. Export de l'agence fusionné ([PR n° 22](https://github.com/lucas3004-sudo/lucas/pull/22)).
- **2026-11-21, export complet de l'agence** : 8 fichiers CSV pour Excel, réservé au gérant avec double authentification, formules neutralisées, journalisé ; décision D-052. Suivi des mandats fusionné ([PR n° 21](https://github.com/lucas3004-sudo/lucas/pull/21)) ; migration 0019 appliquée en préproduction (19 migrations, même empreinte qu'en local).
- **2026-11-21, suivi des mandats (F5)** : migration 0019 (numéro unique par agence, dates cohérentes), carte « Mandat » sur la fiche du bien, rappel 30 jours avant la fin, mandats expirés dans « Qualité des données » ; décision D-051. Accessibilité fusionnée ([PR n° 20](https://github.com/lucas3004-sudo/lucas/pull/20)).
- **2026-11-21, accessibilité** : audit automatique axe-core (WCAG 2.1 AA) de 27 pages en thèmes clair et sombre, sur mobile et au clavier, avec un contrôle positif. Corrigés : contraste du texte discret, tableaux défilants inaccessibles au clavier, lien d'évitement ajouté. Compte rendu de visite fusionné ([PR n° 19](https://github.com/lucas3004-sudo/lucas/pull/19)) ; migration 0018 appliquée en préproduction (18 migrations, 72 règles d'accès, même empreinte qu'en local).
- **2026-11-21, compte rendu de visite (F9, sans IA)** : migration 0018 (comptes rendus sous RLS, lisibles par le responsable du bien), texte pour le vendeur sans le nom des visiteurs, visites à rendre compte en tête de l'agenda, synthèse sur la fiche du bien, inclusion dans l'export RGPD ; décision D-049.
- **2026-11-21, formules et quotas** : grille D-014 appliquée par le logiciel, sans paiement. Formule de l'agence (Essai par défaut), compteurs calculés par la base sans révéler les éléments privés, refus au quota pour les dossiers, les contacts, l'import et les invitations, page « Formule et consommation » (migrations 0016 et 0017, D-048). CSP et contrôle de version fusionnés ([PR n° 17](https://github.com/lucas3004-sudo/lucas/pull/17)). Fusionné ([PR n° 18](https://github.com/lucas3004-sudo/lucas/pull/18)) ; migrations 0016 et 0017 appliquées en préproduction (17 migrations, 67 règles d'accès, même empreinte qu'en local).
- **2026-11-21, contrôle de version de la base** : liste des migrations attendues avec un garde-fou, refus de servir l'application sur une base en retard, état de santé public `/api/health` (D-046, migration 0015).
- **2026-11-21, sécurité** : politique de sécurité du contenu stricte, avec un nonce par requête, et politique fermée pour les API (D-045) ; une injection XSS typique est bloquée (test de bout en bout et contrôle sans CSP). Socle des agents fusionné ([PR n° 16](https://github.com/lucas3004-sudo/lucas/pull/16)) ; migration 0014 appliquée en préproduction (14 migrations, schéma identique).
- **2026-11-21, socle des agents (sans IA)** : package `@immopilot/agents` (passerelle, missions), migration 0014 (missions, étapes, approbations sous RLS), Agent Center, boîte d'approbations, fusion de doublons approuvée ; décision D-044. Qualité des données fusionnée ([PR n° 15](https://github.com/lucas3004-sudo/lucas/pull/15)).
- **2026-11-21, qualité des données** : premier agent déterministe (sans IA), qui signale sans corriger. Double authentification fusionnée ([PR n° 14](https://github.com/lucas3004-sudo/lucas/pull/14)) ; migration 0013 appliquée en préproduction (13 migrations, schéma identique au local).
- **2026-11-21, double authentification** : extension TOTP de Better Auth (migration 0013), page « Sécurité du compte », étape de vérification à la connexion, codes de secours, rappel au gérant ; décision D-043. Photos fusionnées ([PR n° 13](https://github.com/lucas3004-sudo/lucas/pull/13)) ; migration 0012 appliquée en préproduction.
- **2026-11-21, photos des biens** : migration 0012 (photos sous RLS), contrôle du format par les octets et suppression des métadonnées (EXIF, GPS), galerie et affichage protégé ; décision D-042. Annonce et « Ma journée » fusionnées ([PR n° 11](https://github.com/lucas3004-sudo/lucas/pull/11), [PR n° 12](https://github.com/lucas3004-sudo/lucas/pull/12)) ; migration 0011 appliquée en préproduction.
- **2026-11-21, accueil « Ma journée »** : les éléments du jour de chaque utilisateur, sans comparaison entre collègues.
- **2026-11-21, fiche annonce** : migration 0011 (champs d'annonce, lien du barème), contrôle des mentions et texte sans IA, copie bloquée si une mention manque ; décision D-041. Affaires fusionnées ([PR n° 10](https://github.com/lucas3004-sudo/lucas/pull/10)) ; migration 0010 appliquée en préproduction (44 règles d'accès, même empreinte qu'en local).
- **2026-11-21, suivi des affaires (F12)** : migration 0010 (affaires sous RLS, visibilité héritée du bien), calendrier des jours fériés et délai de rétractation, pièces par étape, pilotage des actes signés ; décision D-040.
- **2026-11-21, alertes de correspondance (F11 v1)** : tâche automatique pour les collègues concernés à la création ou à l'import d'un bien ; décision D-039. Import CSV fusionné ([PR n° 8](https://github.com/lucas3004-sudo/lucas/pull/8)).
- **2026-11-21, import CSV** : contacts et biens, aperçu puis import revérifié, encodage Excel, doublons écartés, aucun consentement importé ; décision D-038. Agenda et export RGPD fusionnés ([PR n° 7](https://github.com/lucas3004-sudo/lucas/pull/7)) ; migration 0009 appliquée en préproduction (39 règles d'accès, même empreinte qu'en local).
- **2026-11-21, agenda et export RGPD** :
  - migration 0009 (rendez-vous sous RLS, 3 tests d'isolation de plus, soit 27) ;
  - conversion heure de Paris ⇄ UTC testée aux changements d'heure ;
  - export calendrier conforme au standard .ics ;
  - export des données d'un contact ; décision D-037.
- **2026-11-20, pilotage du gérant (F13)** : tableau de bord mesuré, sans classement ; création manuelle de tâche désormais journalisée ; décision D-036. Investment Studio fusionné ([PR n° 5](https://github.com/lucas3004-sudo/lucas/pull/5)).
- **2026-11-20, Investment Studio** : domaine de simulation (12 cas calculés à la main), écran avec sensibilité, liens depuis les biens et les dossiers, décision D-035. CRM fusionné dans `main` ([PR n° 4](https://github.com/lucas3004-sudo/lucas/pull/4)).
- **2026-11-20, CRM et matching** :
  - migrations 0007 (contacts, consentements, profils, biens, tâches, sous RLS) et 0008 (correctif) ;
  - domaine : matching expliqué et détection des doublons ;
  - écrans Contacts, Biens de l'agence, Tâches ; matching à l'échelle de l'agence ;
  - **défaut de sécurité trouvé par un test et corrigé** : une règle « le profil suit le responsable du contact » était toujours vraie (colonne SQL non qualifiée) ;
  - seuils anti-abus réglables pour la CI ; décisions D-031 à D-034 ;
  - migrations 0007 et 0008 appliquées en préproduction (Supabase), règles de sécurité identiques au local (34 règles, même empreinte) ;
  - autorisation permanente du fondateur pour les fusions et les migrations testées (CLAUDE.md).
- **2026-11-20, phase 4** :
  - domaine DVF porté en TypeScript (identique au prototype) ;
  - schéma `ref` avec PostGIS dans `extensions` ;
  - adaptateurs avec nouvelles tentatives (coupures de Géorisques constatées) ;
  - ingestion réelle : Somme, loyers, zonage ;
  - dossier de bien complet avec provenance et impression PDF ;
  - décisions D-028 à D-030.
- **2026-11-20, phase 3** :
  - monorepo pnpm/Turborepo, base locale PostgreSQL 16 + PostGIS, 4 migrations ;
  - isolation RLS reliée aux adhésions réelles, avec contre-épreuve du garde-fou ;
  - Better Auth (agences, rôles, invitations), routes HTTP de gestion d'agence fermées (D-021) ;
  - design system clair et sombre, 11 écrans, CI GitHub Actions ;
  - test réel du limiteur : seuil ajusté (D-022) ;
  - décisions D-020 à D-025.
- **2026-11-20, phase 2** :
  - stratégie adaptée à la cible « petites agences » : rôles, visibilité, matching à l'échelle de l'agence, tableau de bord du gérant (F13) ;
  - prototype RLS : un défaut trouvé (la fonction `SECURITY DEFINER` était bloquée par `FORCE`), corrigé, contrôles positifs ajoutés, 12 tests sur 12 ;
  - prototype DVF : règles R1 à R5, médiane corrigée de 20 % ;
  - rapprochement DPE ↔ BAN vérifié ;
  - architecture, modèle de données, matrice des permissions, moteur d'agents et ingestion rédigés ;
  - décisions D-014 à D-019.
- **2026-11-20, phase 1** : étude concurrentielle (Hektor, Apimo, Modelo, Yanport, PriceHubble, Casafari, LyBox, Horiz.io). Condamnations de Jinka pour scraping identifiées : D-002 confirmée, D-011 ajoutée. Comparaison des fournisseurs d'annonces et modèle de demande de devis. Fiche juridique (mentions obligatoires, prospection, RGPD, AI Act, Hoguet) et 8 questions pour l'avocat. Loyers ANIL, zonage ABC, BPE, transports et fond de carte IGN testés et ajoutés au script. Guide d'entretien (8 hypothèses). Proposition de prix, de quotas et d'un MVP de 12 fonctions et 19 agents. Ajout de `CLAUDE.md` : les questions au fondateur passent par des choix à cocher.
- **2026-11-20, phase 0** : audit du dépôt (vide ; ancien prototype CalcWidget non réutilisable, avec une faille XSS et un calcul erroné). Création de l'environnement cloud `lucas`, limité aux données publiques. Test des sources. Découverte de la suppression annoncée du répertoire DVF par commune et de la migration de la BAN. Architecture, organisation des agents et roadmap proposées.
