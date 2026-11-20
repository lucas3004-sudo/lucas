# Progression — ImmoPilot AI

Dernière mise à jour : 2026-11-20

Règle : une fonctionnalité n'est marquée terminée que si elle est testée et que ses critères
d'acceptation sont vérifiés.

## État des phases

| Phase | Statut | Livrables |
|---|---|---|
| 0. Audit | ✅ Terminée (2026-11-20) | [Audit](docs/phase-0-audit.md), [Décisions](docs/DECISIONS.md), [Script de vérification des sources](scripts/check-data-sources.sh) |
| 1. Recherche et stratégie | ✅ Livrée (2026-11-20), 2 choix attendus du fondateur | [Stratégie, prix, MVP](docs/phase-1-strategie.md), [Concurrents](docs/research/concurrents.md), [Fournisseurs d'annonces](docs/research/fournisseurs-annonces.md), [Données complémentaires](docs/research/donnees-complementaires.md), [Fiche juridique](docs/legal/fiche-juridique.md), [Guide d'entretien](docs/research/guide-entretien.md) |
| 2. Architecture détaillée | ⏳ Prochaine | — |
| 3. Fondation (+ préproduction) | À faire | — |
| 4. Intelligence immobilière | À faire | — |
| 5. Socle agents | À faire | — |
| 6. Outils professionnels (fin du MVP) | À faire | — |
| 7. Organisation entreprise (CEO, Council, Devil's Advocate) | À faire | — |
| 8. Monétisation | À faire | — |
| 9. Qualité et sécurité (audit formel) | À faire | — |
| 10. Espace particuliers | À faire | — |
| 11. Production | À faire | — |

## Fonctionnalités opérationnelles
Aucune fonctionnalité applicative pour le moment. Seul le script de vérification des sources fonctionne : il couvre 15 sources, dont 7 critiques.

## Vérifié
- [x] Sources critiques : BAN, API Géo, Géorisques (GASPAR et rapport), DPE ADEME, métadonnées et fichier national DVF. Lancer `./scripts/check-data-sources.sh` (sortie 0 le 2026-11-20 à 15:20 UTC).
- [x] Sources complémentaires : loyers ANIL 2025 (Amiens : 13,40 €/m², intervalle 11,00 à 16,33 €), zonage ABC (Amiens : B1), transport.data.gouv (816 jeux), fond de carte IGN, BPE INSEE 2025.
- [x] Couverture DVF : Alsace-Moselle absente (404 sur Strasbourg).
- [x] Coupures ponctuelles constatées (Géorisques, static.data.gouv.fr) : le script fait désormais 2 nouvelles tentatives.
- [ ] Cerema DVF+ : injoignable. Non bloquant, non retenu.

## Décisions en attente du fondateur
1. **Grille tarifaire** (D-014) : option A (19/59/99/249 €) ou option B (79/149/299 €).
2. **Cible prioritaire du lancement.**
3. Clé API Anthropic avec plafond de dépense, avant la phase 5.
4. Choix de l'hébergement, en fin de phase 3.
5. Envoi des demandes de devis aux fournisseurs d'annonces (modèle d'e-mail prêt dans `docs/research/fournisseurs-annonces.md`).
6. Entretiens avec 1 ou 2 agents immobiliers (guide prêt dans `docs/research/guide-entretien.md`).
7. Consultation d'un avocat avant la commercialisation (questions prêtes dans `docs/legal/fiche-juridique.md`).
8. Projet Vercel relié au dépôt : à vérifier en phase 3 (D-009).

## Journal
- **2026-11-20, phase 1** : étude concurrentielle (Hektor, Apimo, Modelo, Yanport, PriceHubble, Casafari, LyBox, Horiz.io). Condamnations de Jinka pour scraping identifiées : D-002 confirmée, D-011 ajoutée. Comparaison des fournisseurs d'annonces et modèle de demande de devis. Fiche juridique (mentions obligatoires, prospection, RGPD, AI Act, Hoguet) et 8 questions pour l'avocat. Loyers ANIL, zonage ABC, BPE, transports et fond de carte IGN testés et ajoutés au script. Guide d'entretien (8 hypothèses). Proposition de prix, de quotas et d'un MVP de 12 fonctions et 19 agents. Ajout de `CLAUDE.md` : les questions au fondateur passent par des choix à cocher.
- **2026-11-20, phase 0** : audit du dépôt (vide ; ancien prototype CalcWidget non réutilisable, avec une faille XSS et un calcul erroné). Création de l'environnement cloud `lucas`, limité aux données publiques. Test des sources. Découverte de la suppression annoncée du répertoire DVF par commune et de la migration de la BAN. Architecture, organisation des agents et roadmap proposées.
