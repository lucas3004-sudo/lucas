# Carte des biens (gratuite)

Chercher les biens selon ses critères sur une carte, et repérer d'un coup d'œil ceux affichés **sous le prix du marché**. Coût : 0 €, sans compte externe.

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
