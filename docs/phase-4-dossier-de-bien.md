# Phase 4 — Dossier de bien (intelligence immobilière)

- **Date** : 20 novembre 2026
- **Statut** : livré et testé en local et en CI. En préproduction, les données publiques restent à charger (voir section 6).
- **Capture** : `docs/captures/08-dossier-de-bien.png` (dossier réel : 8 boulevard du Port, Amiens)

## 1. Ce que fait le module
À partir d'une **adresse** (Base Adresse Nationale) et de caractéristiques **déclarées** (type, surface, pièces), le dossier rassemble :

| Bloc | Source | Statut affiché |
|---|---|---|
| Adresse normalisée | BAN (Géoplateforme), géocodée de nouveau côté serveur | Vérifiée |
| Ventes comparables (les 15 plus proches affichées) | DVF nettoyées (R1 à R5), même type, ancien, surface de 0,5 à 1,5 fois, sur les 24 derniers mois disponibles, rayon de 500 m élargi jusqu'à 3 km | Vérifiée / Manquante |
| Estimation indicative | Quartiles des prix au m² des comparables × surface, arrondis au millier, avec un niveau de confiance (nombre et dispersion) | Estimée / Manquante |
| Loyer de marché | Carte des loyers ANIL (segment selon type et nombre de pièces), avec intervalle et fiabilité du modèle | Estimée |
| DPE | ADEME, par identifiant BAN. Plusieurs DPE : avertissement. Alertes « expiré » et « coefficient électricité 2026 » | Vérifiée / Manquante |
| Risques | Géorisques : statut **commune** et statut **adresse**, lien vers le rapport officiel | Vérifiée / Manquante |
| Zonage | Zonage ABC en vigueur | Vérifiée |

- Le dossier est un **instantané immuable** (`app.analyses`). Le recalculer crée un nouveau dossier.
- Une source indisponible ne bloque pas le dossier : son bloc indique la raison.
- **Export PDF** : bouton « Imprimer / PDF » (impression du navigateur), qui produit un document identique à l'écran, sans la navigation (D-028).

## 2. Résultat réel vérifié (8 boulevard du Port, Amiens ; appartement 60 m², 3 pièces)

| Indicateur | Valeur |
|---|---|
| Comparables | 82 ventes dans un rayon de 500 m, du 30/06/2024 au 30/06/2026 |
| Prix au m² | Q1 1 900 €, médiane 2 301 €, Q3 2 815 € |
| Estimation | **114 000 € à 169 000 €** (centre 138 000 €), confiance **moyenne** |
| Loyer | 572 à 886 €/mois (9,53 à 14,77 €/m², T3 et plus, millésime 2025) |
| DPE | Aucun à cette adresse : statut « manquante » |
| Risques | 9 risques recensés dans la commune, dont inondation (« non connu » à l'adresse) |
| Zonage | B1 |

## 3. Composants livrés
- `packages/domain` : nettoyage DVF (R1 à R5), statistiques, estimation. **Le test de référence sur le vrai fichier d'Amiens reproduit exactement le prototype.**
- `packages/integrations` : HTTP avec nouvelles tentatives, data.gouv, DVF en flux, loyers, zonage, BAN, DPE, Géorisques.
- `packages/db` : migration 0005 (schéma `ref`, PostGIS dans `extensions`) et migration 0006 (`app.analyses`, sous RLS, immuable).
- Commande d'ingestion : `pnpm --filter @immopilot/integrations ingest dvf --departements 80 | loyers | zonage` (rôle `app_ingest`).
- Écrans : liste des dossiers, nouveau dossier (suggestions d'adresses), dossier, impression.

## 4. Tests

| Niveau | Nombre | Contenu |
|---|---|---|
| Unitaires domaine | 16 (+1 de référence) | Quartiles, CSV, chaque règle R1 à R5, estimation, confiance |
| Unitaires intégrations | 14 | Nouvelles tentatives (coupure, 429, 503, pas de nouvel essai sur 404), formats réels BAN, DPE, Géorisques, loyers, zonage |
| Intégration base | 15 | Dont 4 sur les dossiers : isolation, immuabilité, pas de création au nom d'un autre, suppression réservée |
| Bout en bout | 6 | Dont le dossier complet sur une vraie adresse |

## 5. Ingestion mesurée (base locale, 20/11/2026)

| Source | Volume | Durée |
|---|---|---|
| Zonage ABC | 34 875 communes | 4 s |
| Loyers ANIL 2025 | 139 600 lignes (4 types de bien) | 19 s |
| DVF Somme (3 fichiers nationaux lus en flux) | 73 919 lignes, soit 27 503 ventes, dont 16 156 retenues | 1 min 29 s |

## 6. Limites et suites
- **Préproduction** : les migrations 0005 et 0006 sont appliquées. Le chargement des données publiques (DVF d'un ou deux départements, loyers et zonage) se fera une fois le site en ligne. La base gratuite (500 Mo) ne peut pas contenir la France entière.
- L'estimation ne tient pas compte de l'état, de l'étage, de l'exposition ni des travaux. L'agent pourra ajuster la valeur de façon tracée (évolution prévue avec le CRM, en phase 6).
- Équipements (BPE), transports et cadastre ne sont pas encore intégrés au dossier : prochaine itération.
- Les noms des statuts Géorisques sont repris tels que fournis par la source (par exemple « Risque Concerne »).
