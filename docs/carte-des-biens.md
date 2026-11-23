# Carte des biens et fiche du bien (gratuites)

Chercher les biens selon ses critères sur une carte moderne, repérer d'un coup d'œil ceux affichés **sous le prix du marché**, puis ouvrir leur **fiche** façon annonce. Coût : 0 €, sans compte externe.

## Version 2 (2026-11-23), à la demande du fondateur : « une carte belle et professionnelle »
- **Moteur MapLibre GL 5.24.0** (vectoriel : zoom fluide, rotation, plein écran, échelle). Il remplace Leaflet.
- **Fond épuré** dérivé du style officiel PLAN IGN (`lib/map/basemap.ts`, testé) : couleurs douces, routes blanches à fin liseré, eau bleu clair. Les sigles d'équipements, le relief et les parcelles sont masqués ; seuls les noms de rues, de lieux et de cours d'eau restent.
- **Vue satellite** : orthophotos de l'IGN, sans clé.
- **Biens regroupés** quand on dézoome (pastille avec le nombre), étiquettes de prix (« 120 k€ »), couleur selon la position par rapport au marché.
- **Panneau de cartes à photo** à côté de la carte : prix, €/m², type, surface, pièces, repère. Le survol d'une carte met le bien en avant sur la carte.
- **Critères complets** (`lib/map/filters.ts`, testé) : lieu (commune, rue ou adresse, via la BAN) et rayon (500 m à 20 km, cercle tracé), type, prix minimum et maximum, surface minimum et maximum, pièces, prix au m², DPE, équipements, statut, bonnes affaires, avec photos, mes biens ; cinq tris.
- **Fiche du bien** (`/app/proprietes/<id>/fiche`) :
  - carrousel de photos (flèches, clavier, glissement du doigt, vignettes), description, caractéristiques, étiquettes DPE et GES ;
  - **analyse du marché chiffrée**, calculée par le même moteur que le dossier de bien : fourchette estimée sur les ventes comparables, médiane de la commune, rendement locatif brut (loyers ANIL), risques (Géorisques), zonage ABC ;
  - un **verdict** (bonne affaire, prix cohérent, prix élevé, analyse incomplète) qui suit l'écart au milieu de la fourchette, avec le même seuil de ±10 % que la carte ;
  - l'analyse rédigée par l'IA s'y ajoutera dès que la clé sera configurée (D-056).

## Ce qui est construit
- **Page « Carte »** (`/app/carte`) :
  - fond de carte de l'IGN (Géoplateforme), public et sans clé ;
  - bibliothèque **Leaflet 1.9.4**.
- **Biens de l'agence** (règles d'accès de la base : chacun voit ce qu'il a le droit de voir) :
  - filtrables par type, prix maximum, surface minimum, pièces minimum, statut, « mes biens seulement » ;
  - une liste triée sous la carte, les meilleures affaires d'abord. C'est aussi l'alternative accessible au clavier et aux lecteurs d'écran.
- **Repère « bonne affaire »** (`packages/domain/src/market/position.ts`) :
  - prix affiché au m², comparé à la **médiane des ventes réelles** (DVF, logements anciens) de la même commune et du même type, sur 24 mois ;
  - **sous le marché** à −10 % ou plus, **au-dessus** à +10 % ou plus ;
  - aucun verdict avec moins de 10 ventes, ni sans prix ou sans surface.
- **Ventes réelles autour** (`/api/v1/carte/ventes`) :
  - les ventes des 24 derniers mois dans la zone affichée, à partir d'un zoom de quartier ;
  - 1 500 au maximum, les plus récentes ;
  - date, type, surface, prix et prix au m² **seulement, sans adresse** (conditions de réutilisation de DVF) ;
  - réservé aux utilisateurs connectés ; une zone trop large est refusée (« zoomez ») ;
  - la recherche utilise l'index géographique de la base.
- **Sécurité** :
  - les bulles d'information sont construites sans HTML : aucune donnée saisie ne peut s'exécuter ;
  - la politique de sécurité autorise seulement les images de `data.geopf.fr`.

## Ce que la carte n'affiche pas
**Les annonces des autres agences et des particuliers.** Aucune source publique et gratuite ne les fournit légalement, et le scraping des portails est exclu (D-002). Elles s'ajouteront sur cette même carte quand un fournisseur sous licence sera choisi : prix, droits et questions dans `docs/research/fournisseurs-annonces.md`.

## Tests
- 3 tests unitaires du repère : seuils, cas sans verdict, libellés.
- 1 scénario de bout en bout :
  - bien placé sur la carte ;
  - « Sous le marché (−22 %) » à Amiens, avec les données DVF ;
  - filtres par critères ;
  - API des ventes : sans adresse, zone invalide → 400, zone trop large refusée.
- La page « Carte » est ajoutée à l'audit d'accessibilité (WCAG 2.1 AA, thèmes clair et sombre).

## Prochaines étapes possibles
- Zones recherchées par les acquéreurs (nombre de profils par commune, sans identité).
- Annonces du marché via un fournisseur sous licence (accord du fondateur nécessaire : coût).
