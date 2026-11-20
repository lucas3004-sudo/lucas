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
| 3. Fondation (+ préproduction) | 🟡 Fondation livrée, testée en local et en CI (au vert). Base de préproduction Supabase prête et testée ; **reste la création du compte Vercel par le fondateur** | [Design system](docs/design-system.md), [captures](docs/captures/), code dans `apps/web` et `packages/db` |
| 4. Intelligence immobilière | À faire | — |
| 5. Socle agents | À faire | — |
| 6. Outils professionnels (fin du MVP) | À faire | — |
| 7. Organisation entreprise (CEO, Council, Devil's Advocate) | À faire | — |
| 8. Monétisation | À faire | — |
| 9. Qualité et sécurité (audit formel) | À faire | — |
| 10. Espace particuliers | À faire | — |
| 11. Production | À faire | — |

## Fonctionnalités opérationnelles (testées)
**Application (phase 3)** :
- **Comptes** : inscription, connexion, déconnexion. Mot de passe de 12 caractères minimum. Limitation des tentatives (429 constaté).
- **Agences** : création (le créateur devient gérant), choix de l'agence active.
- **Équipe** : invitation par lien (7 jours), acceptation, changement de rôle, retrait.
  - Règles testées : un manager ne nomme jamais de gérant, l'agence garde toujours un gérant.
- **Paramètres** : nom de l'agence (gérant seulement), visibilité par défaut (gérant et managers). Enregistrés sous RLS.
- **Journal d'audit** : ajout seul, lecture réservée au gérant et aux managers.
- **Isolation entre agences** dans la base (RLS), avec un garde-fou automatique « aucune table oubliée ».
- **Design** : thème clair et sombre, affichage mobile, navigation limitée aux modules construits.

**Tests** (tous au vert le 2026-11-20) :
- 21 tests unitaires (règles de rôle, contexte d'agence, garde-fous) ;
- 11 tests d'intégration sur PostgreSQL (attaques d'isolation, contre-épreuve du garde-fou) ;
- 5 scénarios de bout en bout (Playwright) ;
- lint, types, build de production.

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
- **Vérification de l'adresse e-mail** et envoi des invitations par e-mail : nécessitent un service d'e-mail, donc un compte externe (D-023).
- **Double authentification** obligatoire pour le gérant (prévue au socle de sécurité) : pas encore construite.
- CSP sans nonces (`unsafe-inline`) : durcissement prévu en phase 9.

## Décisions en attente du fondateur
1. **Création du compte Vercel gratuit** et import du dépôt (guide pas à pas fourni). La base Supabase est prête.
2. **Création du compte Brevo** (e-mails), choisi le 2026-11-20 : à guider après la mise en ligne.
2. Clé API Anthropic avec plafond de dépense, avant la phase 5.
3. Demandes de devis aux fournisseurs d'annonces : **reportées** avant la phase 6 (choix du fondateur).
4. Entretiens avec 1 ou 2 agents ou gérants d'agence (guide prêt dans `docs/research/guide-entretien.md`, avec les questions pour gérant).
5. Consultation d'un avocat avant la commercialisation (10 questions prêtes dans `docs/legal/fiche-juridique.md`).
6. Projet Vercel relié au dépôt : à vérifier en phase 3 (D-009).

Décidé le 2026-11-20 : prix d'entrée (D-014), cible « petites agences » (D-015), lancement de la phase 2.

## Journal
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
