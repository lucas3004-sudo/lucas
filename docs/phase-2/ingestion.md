# Phase 2 — Ingestion des données publiques

- **Date** : 20 novembre 2026
- **Vérification des sources** : `./scripts/check-data-sources.sh` (15 sources, dont 7 critiques)
- **Prototype des règles DVF** : `prototypes/dvf/clean_dvf.py`

## 1. Principes communs
- **Un adaptateur par source** (`packages/integrations/<source>`) derrière une interface commune. Une source peut donc être remplacée sans toucher au reste.
- Chaque adaptateur déclare : sa licence, la **citation obligatoire**, sa fréquence de mise à jour, ses limites connues, sa stratégie de cache.
- **Nouvelles tentatives** : 3 au maximum, délai croissant. Des coupures ponctuelles ont été constatées sur Géorisques et `static.data.gouv.fr` le 20/11/2026.
- **URL jamais codées en dur** pour les fichiers datés. L'URL courante est lue dans l'API de data.gouv.fr à chaque ingestion.
- **Traçabilité** : chaque ingestion écrit une ligne dans `ref.source_runs` (millésime, URL, lignes lues, retenues, rejetées par règle, statut). L'interface affiche la **date de fraîcheur** de chaque source.
- **Encodage** détecté et testé par fichier : Latin-1 pour les loyers ANIL, UTF-8 pour le zonage ABC.

## 2. Tableau des sources

| Source | Mode | Fréquence | Stockage | Usage |
|---|---|---|---|---|
| BAN (Géoplateforme) | API, à la demande | — | `ban_id` et coordonnées enregistrés sur le bien | Normaliser l'adresse, clé de rapprochement |
| DVF géolocalisées | Fichier national (`static.data.gouv.fr`) | Semestrielle (avril, octobre) | `ref.dvf_raw` puis `ref.dvf_mutations` | Comparables, prix au m², statistiques de marché |
| DPE ADEME (`dpe03existant`) | API, à la demande par `identifiant_ban`, puis cache | Base mise à jour en continu | `ref.dpe` (cache) | DPE du bien, classes énergie et climat, coûts estimés |
| Géorisques | API, à la demande (rapport par coordonnées) | — | `ref.risks_cache`, valide 30 jours | Risques naturels et technologiques |
| Loyers ANIL | Fichiers CSV par type de bien | Annuelle (décembre) | `ref.loyers` | Loyer estimé pour la rentabilité |
| Zonage ABC | Fichier CSV | À chaque arrêté | `ref.zonage_abc` | Tension du marché, dispositifs |
| BPE INSEE | Fichier CSV ou Parquet (~136 Mo) | Annuelle, ajustements mensuels | `ref.bpe` (PostGIS) | Équipements à proximité |
| Cadastre (API Carto IGN) | API, à la demande | — | Cache sur le bien | Parcelle, surface du terrain |
| Transports (transport.data.gouv.fr) | Arrêts GTFS par réseau, **Licence Ouverte seulement** | Selon le réseau | `ref.transport_stops` (PostGIS) | Arrêts à proximité (phase 4, si le temps le permet) |

## 3. DVF : règles de nettoyage (mesurées sur Amiens 2025)

**Données** : fichier DVF 2025 d'Amiens (INSEE 80021), soit **5 439 lignes pour 2 305 ventes**, dont 426 lignes en double (le même local répété sur plusieurs parcelles ou cultures).

| Règle | Contenu | Ventes exclues (Amiens 2025) |
|---|---|---|
| **R1** Nature | On garde « Vente » (ancien) et « Vente en l'état futur d'achèvement » (neuf, **analysé à part**). On exclut adjudication, échange, terrain à bâtir… | 12 |
| **R2** Regroupement | Une vente = un `id_mutation`. Les locaux répétés sont fusionnés selon la clé (type, surface, pièces, parcelle, lot) | (fusion, pas d'exclusion) |
| **R3** Composition | Exactement **un** logement (appartement ou maison), avec 0 à n dépendances, sans local commercial. Les ventes de plusieurs logements sont exclues, car leur prix au m² n'a pas de sens | 624 |
| **R4** Validité | Surface bâtie ≥ 9 m², valeur foncière > 0 | 2 |
| **R5** Valeurs extrêmes | Prix au m² hors de [200 ; 25 000] € ou hors de [Q1 − 3·IQR ; Q3 + 3·IQR], par type et par nature | 4 |

**Effet mesuré** :

| Segment | Calcul naïf (une ligne = une vente) | Après nettoyage |
|---|---|---|
| Appartements | médiane **2 963 €/m²**, Q1 à Q3 : 2 208 à **7 735** (n = 1 279 lignes) | Ancien : médiane **2 470 €/m²**, Q1 à Q3 : 1 893 à 2 957 (n = 767). Neuf : 3 858 €/m² (n = 17) |
| Maisons | médiane 2 301 €/m² (n = 982 lignes) | Ancien : médiane **2 265 €/m²**, Q1 à Q3 : 1 818 à 2 797 (n = 877). Neuf : n = 2, **trop peu pour conclure** |

**Conclusion** : pour les appartements, le calcul naïf **surestime la médiane de 20 %** (2 963 € contre 2 470 €) et donne un 3e quartile absurde (7 735 €), à cause des ventes de plusieurs appartements et du mélange entre neuf et ancien. Pour les maisons, l'écart est faible.

**Cas de test de la phase 4** : ces chiffres deviennent des tests de non-régression de `packages/domain/dvf`. Le même fichier, nettoyé par l'implémentation TypeScript, doit donner les mêmes effectifs et les mêmes médianes que le prototype.

**Comparables d'un bien** (phase 4) :
1. ventes nettoyées du même type et de la même nature (ancien ou neuf) ;
2. dans un rayon de départ de 500 m, élargi par paliers jusqu'à obtenir au moins 10 ventes, avec un plafond de 3 km ;
3. sur les 24 derniers mois ;
4. surface comprise entre la moitié et une fois et demie celle du bien.

On affiche le nombre de ventes, la médiane, l'intervalle Q1 à Q3, le rayon et la période réellement utilisés.

**Niveau de confiance** :
- **élevé** : au moins 20 comparables et un rapport (Q3 − Q1) / médiane inférieur à 0,3 ;
- **faible** : moins de 8 comparables, ou un rapport supérieur à 0,5 ;
- **moyen** : entre les deux.

Ces seuils seront ajustés sur plusieurs communes en phase 4.

**Zones non couvertes** : en Bas-Rhin, Haut-Rhin, Moselle et à Mayotte, le produit affiche « DVF non disponible dans ce département (régime du Livre foncier) » et aucune estimation fondée sur DVF.

## 4. DPE : rapprochement avec le bien (vérifié)

- **Clé** : `identifiant_ban` de la base ADEME = identifiant BAN de l'adresse géocodée. **Testé sur 5 DPE d'Amiens bien géocodés (score BAN supérieur à 0,9) : 5 identiques sur 5.**
- **Adresse sans DPE** (exemple : 8 boulevard du Port à Amiens, 0 résultat) : statut `manquante`. Le produit l'affiche et ne devine rien.
- **Plusieurs DPE à la même adresse** (immeuble) : on présente la liste (date, classe, surface, type de bâtiment) et **l'utilisateur choisit**. Pas de choix automatique.
- On ignore un DPE remplacé (`numero_dpe_remplace`) ou expiré (`date_fin_validite_dpe`), ou on le signale comme tel.
- **DPE antérieur au 01/01/2026** pour un logement chauffé à l'électricité : on affiche l'alerte « classe susceptible d'avoir changé (coefficient électricité 1,9) ».
- Champs utiles relevés : `numero_dpe`, `date_etablissement_dpe`, `date_fin_validite_dpe`, `etiquette_dpe`, `etiquette_ges`, `conso_5_usages_par_m2_ep`, `emission_ges_5_usages_par_m2`, `cout_total_5_usages`, `surface_habitable_logement`, `type_batiment`, `identifiant_ban`, `score_ban`.

## 5. Loyers ANIL
- Valeur centrale et intervalle de prédiction **charges comprises**, pour un logement non meublé (3e trimestre 2025). Le passage au hors charges se fait selon une hypothèse modifiable.
- Pour les simulations de rentabilité, la **borne basse est utilisée par défaut** (D-012).
- On signale les estimations peu fiables : `R2_adj` inférieur à 0,5, ou estimation calculée sur un regroupement de communes (`TYPPRED` = « maille ») avec peu d'observations.
- Citation imposée : « Estimations ANIL, à partir des données du Groupe SeLoger et de leboncoin ».

## 6. Ordre de mise en œuvre (phase 4)
1. BAN et DVF : ingestion, nettoyage, comparables. **C'est le cœur du dossier de bien.**
2. DPE (à la demande, avec cache) et Géorisques.
3. Loyers ANIL et zonage ABC.
4. BPE (équipements), puis cadastre.
5. Transports (si le calendrier le permet).
