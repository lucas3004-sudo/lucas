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
| 3. Fondation (+ préproduction) | ⏳ Prochaine | — |
| 4. Intelligence immobilière | À faire | — |
| 5. Socle agents | À faire | — |
| 6. Outils professionnels (fin du MVP) | À faire | — |
| 7. Organisation entreprise (CEO, Council, Devil's Advocate) | À faire | — |
| 8. Monétisation | À faire | — |
| 9. Qualité et sécurité (audit formel) | À faire | — |
| 10. Espace particuliers | À faire | — |
| 11. Production | À faire | — |

## Fonctionnalités opérationnelles
Aucune fonctionnalité applicative pour le moment. Ce qui fonctionne et a été exécuté :
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

## Décisions en attente du fondateur
1. Choix de l'hébergement, en fin de phase 3.
2. Clé API Anthropic avec plafond de dépense, avant la phase 5.
3. Demandes de devis aux fournisseurs d'annonces : **reportées** avant la phase 6 (choix du fondateur).
4. Entretiens avec 1 ou 2 agents ou gérants d'agence (guide prêt dans `docs/research/guide-entretien.md`, avec les questions pour gérant).
5. Consultation d'un avocat avant la commercialisation (10 questions prêtes dans `docs/legal/fiche-juridique.md`).
6. Projet Vercel relié au dépôt : à vérifier en phase 3 (D-009).

Décidé le 2026-11-20 : prix d'entrée (D-014), cible « petites agences » (D-015), lancement de la phase 2.

## Journal
- **2026-11-20, phase 2** :
  - stratégie adaptée à la cible « petites agences » : rôles, visibilité, matching à l'échelle de l'agence, tableau de bord du gérant (F13) ;
  - prototype RLS : un défaut trouvé (la fonction `SECURITY DEFINER` était bloquée par `FORCE`), corrigé, contrôles positifs ajoutés, 12 tests sur 12 ;
  - prototype DVF : règles R1 à R5, médiane corrigée de 20 % ;
  - rapprochement DPE ↔ BAN vérifié ;
  - architecture, modèle de données, matrice des permissions, moteur d'agents et ingestion rédigés ;
  - décisions D-014 à D-019.
- **2026-11-20, phase 1** : étude concurrentielle (Hektor, Apimo, Modelo, Yanport, PriceHubble, Casafari, LyBox, Horiz.io). Condamnations de Jinka pour scraping identifiées : D-002 confirmée, D-011 ajoutée. Comparaison des fournisseurs d'annonces et modèle de demande de devis. Fiche juridique (mentions obligatoires, prospection, RGPD, AI Act, Hoguet) et 8 questions pour l'avocat. Loyers ANIL, zonage ABC, BPE, transports et fond de carte IGN testés et ajoutés au script. Guide d'entretien (8 hypothèses). Proposition de prix, de quotas et d'un MVP de 12 fonctions et 19 agents. Ajout de `CLAUDE.md` : les questions au fondateur passent par des choix à cocher.
- **2026-11-20, phase 0** : audit du dépôt (vide ; ancien prototype CalcWidget non réutilisable, avec une faille XSS et un calcul erroné). Création de l'environnement cloud `lucas`, limité aux données publiques. Test des sources. Découverte de la suppression annoncée du répertoire DVF par commune et de la migration de la BAN. Architecture, organisation des agents et roadmap proposées.
