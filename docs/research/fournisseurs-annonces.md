# Fournisseurs d'annonces immobilières — comparaison et demande de devis

- **Date** : 20 novembre 2026
- **Décision du fondateur (20/11/2026)** : demander des devis, sans engagement ni paiement sans son accord.

## 1. Le problème juridique à vérifier en premier

Le droit des bases de données interdit à la fois l'**extraction** et la **réutilisation** d'une partie substantielle d'une base sans autorisation de son producteur (art. L342-1 du Code de la propriété intellectuelle). Les décisions récentes contre Jinka (SeLoger en décembre 2025, Leboncoin en avril 2026) montrent que les portails font valoir ce droit.

**Conséquence : si un fournisseur obtient ses annonces en aspirant les portails sans accord, ImmoPilot pourrait être poursuivi pour la simple réutilisation de ces données, même en payant le fournisseur.** La question de l'origine des données passe donc avant celle du prix.

## 2. Options identifiées

| Option | Coût observé | Couverture | Origine des données | Verdict provisoire |
|---|---|---|---|---|
| **Stream Estate** (API) | Formule Starter à 99 €/mois sur la page officielle ; quotas et dépassements non confirmés (15 000 éléments/mois selon un annuaire) | Annonce plus de 50 millions d'annonces issues de plus de 900 sources, surtout en France | **Non documentée publiquement.** À vérifier | **À interroger en priorité** (API moderne, webhooks, serveur MCP). Attention : l'API v1 s'arrête le 31/12/2026, il faut viser la v2 |
| **Casafari** (API, exports, MCP) | Non public | Annonces dédoublonnées dans 16 pays | Non documentée publiquement | À interroger |
| **Yanport** (données) | Non public pour une API (l'outil Agent 360 coûte 39 € HT/utilisateur) | France | Non documentée publiquement | À interroger (une offre API n'est pas confirmée) |
| **Fluximmo** | Non public | Plus de 20 portails | Sa page commerciale dit explicitement « Scraper LEBONCOIN, PAP… » | **Exclu** (D-002) |
| Scrapers sur places de marché (Apify, RapidAPI…) | Quelques dollars | — | Scraping | **Exclus** (D-002) |
| **Flux envoyés par les agences elles-mêmes** | Gratuit pour nous | Les mandats de nos clients | Les agences diffusent leurs **propres** annonces vers les supports de leur choix (formats XML comme Poliris, passerelles comme Ubiflow) | **Option la plus sûre** : ImmoPilot devient un support de diffusion qui reçoit les annonces de ses clients. À étudier techniquement en phase 2 |
| **Saisie ou import manuel** | Gratuit | Ce que l'utilisateur saisit | L'utilisateur | Disponible dès le MVP |

## 3. Questions à poser à chaque fournisseur

**Droits et origine des données**
1. D'où proviennent vos annonces ? Disposez-vous d'un accord écrit avec chaque portail ou site source (Leboncoin, SeLoger, Bien'ici, PAP…) ? Si non, sur quel fondement les collectez-vous ?
2. Le contrat inclut-il une **garantie** et une **indemnisation** d'ImmoPilot en cas de réclamation d'un producteur de base de données ?
3. Quels usages sont autorisés : affichage à nos clients professionnels, stockage, calcul de statistiques dérivées, conservation après la fin du contrat ?
4. **Photos** : ont-elles des droits d'auteur ? Pouvons-nous les afficher ?

**Données personnelles**
5. Les annonces de particuliers contiennent-elles des coordonnées (téléphone, e-mail) ? Si oui, quelle est votre base légale RGPD ? Pouvons-nous recevoir les annonces **sans** ces coordonnées ? (Depuis le 11/08/2026, le démarchage téléphonique des particuliers exige leur consentement préalable.)
6. Où sont hébergées les données (UE ?) ? Fournissez-vous un accord de traitement des données (DPA) ?

**Technique**
7. Couverture géographique, délai de mise à jour, dédoublonnage, historique des prix, détection des annonces retirées.
8. Quotas, limites de débit, disponibilité garantie (SLA), webhooks, calendrier de la v2 et des évolutions.
9. Existe-t-il un accès d'essai ou un bac à sable gratuit ?

**Prix**
10. Grille tarifaire complète : volume inclus, prix du dépassement, engagement minimum, tarif pour une startup en phase de lancement, possibilité de refacturer à nos clients.

## 4. Modèle d'e-mail de demande de devis (à envoyer par vous)

> **Objet** : Demande d'information et de devis — accès API aux annonces immobilières
>
> Bonjour,
>
> Je développe ImmoPilot AI, un logiciel d'aide à la décision destiné aux agents immobiliers indépendants et aux petites agences en France. Nous étudions l'intégration d'un flux d'annonces immobilières via API.
>
> Avant toute discussion tarifaire, nous devons vérifier la conformité juridique de la source. Pourriez-vous nous indiquer :
> 1. l'origine de vos annonces et l'existence d'accords écrits avec les portails et sites sources ;
> 2. les garanties contractuelles prévues en cas de réclamation d'un producteur de base de données ;
> 3. les usages autorisés (affichage à nos clients, stockage, statistiques dérivées) et les conditions applicables aux photos ;
> 4. le traitement des coordonnées des particuliers (possibilité de recevoir les annonces sans coordonnées) et votre accord de traitement des données (DPA) ;
> 5. votre grille tarifaire (volume inclus, dépassement, engagement), vos quotas et la disponibilité d'un accès d'essai.
>
> Nous ne prendrons aucun engagement à ce stade. Merci par avance,
>
> [Votre nom] — ImmoPilot AI

## 5. Grille d'évaluation des réponses

| Critère | Poids | Éliminatoire si… |
|---|---|---|
| Origine licite et documentée, garantie contractuelle | 40 % | Pas d'accord avec les sources, ou refus de garantie |
| Données personnelles (sans coordonnées, DPA, hébergement UE) | 20 % | Coordonnées imposées sans base légale |
| Couverture et fraîcheur | 20 % | — |
| Prix compatible avec la marge (voir `docs/phase-1-strategie.md`) | 15 % | Coût par client supérieur à 15 % du prix de l'abonnement |
| Qualité technique de l'API | 5 % | — |

## Sources
- [Stream Estate : page officielle](https://stream-estate.pages.dev/)
- [Stream Estate : README du serveur MCP](https://raw.githubusercontent.com/streamestate/mcp-server/HEAD/README.md)
- [Fluximmo sur RapidAPI](https://rapidapi.com/de/organization/fluximmo)
- [La Fabrique du Net : Casafari](https://www.lafabriquedunet.fr/logiciel/casafari)
- [La Fabrique du Net : Ubiflow](https://www.lafabriquedunet.fr/logiciel/ubiflow)
- [Format de flux SeLoger Poliris (bibliothèque PHP)](https://packagist.org/packages/meilleursbiens/seloger-poliris-feed)
- [MySweetImmo : Jinka condamnée face à SeLoger](https://www.mysweetimmo.com/2025/12/17/immobilier-seloger-fait-condamner-jinka-pour-extraction-et-reutilisation-illicites-de-ses-annonces/)
