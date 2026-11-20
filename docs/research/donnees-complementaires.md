# Données complémentaires — inventaire et tests (phase 1)

- **Date** : 20 novembre 2026
- **Commune de test** : Amiens (INSEE 80021)
- **Vérification reproductible** : `./scripts/check-data-sources.sh`

## 1. Sources testées

| Source | Usage | Licence | Test | Constats |
|---|---|---|---|---|
| **Carte des loyers 2025** (Ministère / ANIL) | Loyer estimé pour la rentabilité locative (Investment Studio, Rental Yield Agent) | Licence Ouverte 2.0, **citation obligatoire** : « Estimations ANIL, à partir des données du Groupe SeLoger et de leboncoin » | OK | Amiens, appartement : **13,40 €/m²** charges comprises, intervalle de prédiction **11,00 à 16,33 €/m²**, 41 032 observations, estimé au niveau de la commune. Fichiers par type (appartement, T1-T2, T3 et plus, maison) pour environ 34 900 communes |
| **Zonage ABC** (Ministère, en vigueur depuis le 26/06/2026) | Tension du marché, dispositifs fiscaux, plafonds | Licence Ouverte 2.0 | OK (après nouvelle tentative) | Amiens : zone **B1**. Fichier encodé en UTF-8 |
| **INSEE BPE 2025**, équipements géolocalisés | Commerces, écoles, santé, sport à proximité (Neighborhood Analysis Agent) | Licence ouverte INSEE | OK (fichier disponible, non téléchargé) | CSV d'environ 136 Mo ou Parquet. Coordonnées GPS. Mis à jour chaque mois (oppositions Sirene) |
| **transport.data.gouv.fr** (API) | Arrêts et lignes de transport en commun (GTFS) | Variable selon le jeu : Licence Ouverte **ou ODbL** | OK | 816 jeux, dont 499 de transport public. Amiens : réseau Ametis (GTFS + temps réel, Licence Ouverte) |
| **Fond de carte IGN « Plan IGN »** (tuiles vectorielles) | Cartes de l'application (MapLibre) | Licence Ouverte | OK | Style et tuiles accessibles sans clé |
| INSEE Filosofi (revenus par commune) | Profil socio-économique du quartier | Licence ouverte INSEE | Même hôte que la BPE (accessible), fichier non testé individuellement | À intégrer en phase 4 |

## 2. Points de vigilance pour l'intégration (phase 4)

1. **Les loyers sont des loyers d'annonce, pas des loyers signés.** Ils sont estimés charges comprises, pour un logement non meublé, au 3e trimestre 2025, sur un logement de référence (appartement de 52 m², maison de 92 m²). Le produit doit :
   - afficher l'intervalle, pas seulement la valeur centrale ;
   - convertir en loyer hors charges selon une hypothèse **modifiable** par l'utilisateur ;
   - signaler les communes où le modèle est peu fiable : R² ajusté inférieur à 0,5 ou peu d'observations (colonnes `R2_adj`, `nbobs_com`, `TYPPRED` = « maille » ou « commune ») ;
   - citer la source sous la forme imposée.
2. **Encodages différents** : le fichier des loyers est en Latin-1 (avec des fins de ligne Windows), celui du zonage ABC en UTF-8. L'ingestion doit détecter l'encodage et tester chaque fichier.
3. **ODbL** : certains jeux de transport (agrégats régionaux) sont sous licence ODbL, qui oblige à partager à l'identique toute base dérivée publiée. On privilégie les jeux sous Licence Ouverte. Une base contenant des données ODbL ne doit pas être republiée.
4. **Coupures ponctuelles constatées** : le rapport Géorisques a renvoyé une réponse vide, et `static.data.gouv.fr` a coupé une connexion, deux fois en quelques minutes avant de répondre de nouveau. La couche d'intégration doit prévoir :
   - de nouvelles tentatives avec délai croissant ;
   - un cache local des référentiels (zonage, loyers, BPE) ;
   - un affichage clair de la date et de l'état de chaque source.
5. **URL datées** : les fichiers de `static.data.gouv.fr` changent d'URL à chaque millésime. L'ingestion lit l'URL courante dans l'API de data.gouv (comme pour DVF), au lieu de la coder en dur.
6. **OpenStreetMap** : c'est une alternative pour les points d'intérêt, mais elle est sous ODbL et l'API Overpass n'est pas faite pour un usage commercial intensif. On l'écarte au profit de la BPE.

## 3. Sources toujours indisponibles ou non retenues
- **Cerema DVF+** (préproduction) : connexion réinitialisée à chaque tentative (5 tests le 20/11/2026). Non retenu.
- **API INSEE** (`api.insee.fr`) : nécessite un compte. Inutile pour le MVP, car les fichiers suffisent.
