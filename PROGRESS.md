# Progression — ImmoPilot AI

Dernière mise à jour : 2026-11-20

Règle : une fonctionnalité n'est marquée terminée que si elle est testée et que ses critères
d'acceptation sont vérifiés.

## État des phases

| Phase | Statut | Livrables |
|---|---|---|
| 0. Audit | ✅ Terminée (2026-11-20) | [Audit](docs/phase-0-audit.md), [Décisions D-001 à D-010](docs/DECISIONS.md), [Script de vérification des sources](scripts/check-data-sources.sh) |
| 1. Recherche et stratégie | ⏳ Prochaine | — |
| 2. Architecture détaillée | À faire | — |
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
Aucune pour le moment. Le dépôt ne contient que la documentation et le script de vérification des sources.

## Vérifié pendant la phase 0
- [x] Sources critiques joignables et renvoyant des données réelles : BAN (Géoplateforme), API Géo, Géorisques (GASPAR et rapport), DPE ADEME, métadonnées et fichier national DVF. Lancer `./scripts/check-data-sources.sh` (sortie 0 le 2026-11-20).
- [x] Couverture DVF : Alsace-Moselle absente (404 sur Strasbourg).
- [ ] Cerema DVF+ : injoignable (connexion réinitialisée). Non bloquant.

## Blocages et décisions en attente du fondateur
1. Clé API Anthropic avec plafond de dépense, nécessaire avant la phase 5.
2. Accord pour demander des devis à des fournisseurs d'annonces sous licence (phase 1).
3. Choix de l'hébergement, nécessaire en fin de phase 3.
4. Contacts d'agents immobiliers pour des entretiens (conseillé en phase 1).
5. Consultation d'un avocat avant la commercialisation.
6. Existe-t-il un projet Vercel relié à ce dépôt ? (D-009)

## Journal
- **2026-11-20** : phase 0. Audit du dépôt (vide, ancien prototype CalcWidget non réutilisable : faille XSS et calcul erroné). Création de l'environnement cloud `lucas` limité aux données publiques. Test des sources. Découverte de la suppression annoncée du répertoire DVF par commune et de la migration de la BAN. Recherche concurrentielle et réglementaire. Architecture, organisation des agents et roadmap proposées.
