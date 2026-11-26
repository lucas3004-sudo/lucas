# Étude : annonces de particuliers et multidiffusion pour ImmoPilot AI

- **Date** : 26 novembre 2026
- **Statut** : étude seule, **aucune intégration développée** (en attente de la validation du fondateur).
- **Méthode** : recherches sur les sites officiels, la documentation publique, la presse spécialisée et les comparatifs. Quand une information n'a pas pu être vérifiée, c'est écrit. **Aucun prix n'est inventé** : les montants cités viennent d'une source (lien en fin de document), et ceux des comparatifs tiers sont signalés comme tels.

---

## 1. En bref

| Besoin | Recommandation | Pourquoi | Coût connu |
|---|---|---|---|
| Annonces de particuliers sur la carte | **Demander deux devis en parallèle : Yanport et Stream Estate**, et ne signer qu'avec une **garantie écrite** sur l'origine des données | Aucun fournisseur ne prouve publiquement qu'il a l'accord des portails. Yanport est l'acteur français le plus installé auprès des agences. Stream Estate a la meilleure API publique (webhooks, prix affichés) | Stream Estate : 99 à 799 €/mois (grille officielle). Yanport : API sur devis |
| Multidiffusion intégrée | **Ubiflow en premier choix, Gédéon (Studio Net) en alternative**, à départager sur devis « éditeur » | Ubiflow couvre le plus de portails. Gédéon annonce publiquement une API REST/JSON, utilisée en coulisse par d'autres logiciels | Ubiflow : 25 à 135 € HT/mois par agence (prix cités, à confirmer). Gédéon : sur devis |
| Abonnements aux portails | **Restent à la charge des agences**, comme aujourd'hui | La passerelle transporte l'annonce ; l'agence garde son contrat avec chaque portail | 300 à 900 €/mois selon un éditeur, ou par exemple 499 € pour 100 annonces (pack Convergence Bien'ici / ParuVendu) |

**Point essentiel sur les coordonnées des vendeurs** : même avec un fournisseur sous licence, une agence **ne peut plus appeler un particulier pour lui proposer ses services sans son accord préalable**. C'est la règle depuis le 11/08/2026 (loi n° 2025-594 et décret n° 2026-662 du 23/07/2026) ; un numéro publié dans une annonce ne vaut pas accord. Le démarchage par e-mail exige lui aussi un accord préalable. L'intérêt de la pige se déplace donc vers la **lettre**, le **rendez-vous d'estimation** et les **contacts qui ont donné leur accord** (page « Estimez votre bien », D-067).

---

## 2. Cadre légal à respecter (vérifié, à faire valider par l'avocat)

1. **Origine des annonces** : copier la base d'un portail sans son accord est interdit : extraction comme réutilisation (art. L342-1 du Code de la propriété intellectuelle). Jinka a été condamné face à SeLoger (cour d'appel de Versailles, 16/12/2025) et face à Leboncoin (200 000 € en appel, avril 2026). **Réutiliser** des données aspirées par un tiers expose aussi ImmoPilot. Exigences au contrat : origine documentée, accords avec les sources, garantie et indemnisation.
2. **Photos et textes** : ils sont protégés par le droit d'auteur du photographe ou de l'auteur. Ne les afficher que si le contrat l'autorise expressément, sinon montrer un lien vers l'annonce d'origine.
3. **Coordonnées des particuliers** (données personnelles, RGPD) :
   - le fournisseur et l'agence doivent avoir une **base légale** (en pratique, l'intérêt légitime, à documenter) ;
   - la personne doit être **informée** (art. 14 du RGPD) et pouvoir **s'opposer** ;
   - **téléphone** : accord préalable obligatoire depuis le 11/08/2026. Il est valable un an au plus, sans reconduction tacite, avec une preuve conservée 3 ans selon les guides professionnels, à confirmer ;
   - **e-mail** : accord préalable obligatoire (art. L34-5 du Code des postes et des communications électroniques) ;
   - **courrier postal** : autorisé, avec droit d'opposition ;
   - beaucoup d'annonces disent « agences s'abstenir ». À respecter : ImmoPilot doit le repérer et le signaler.
4. **PAP** : ses conditions d'utilisation **interdisent aux professionnels de publier**, y compris en se faisant passer pour des particuliers. PAP bloque aussi les agences signalées pour avoir démarché ses vendeurs. **Aucune intégration PAP n'est possible, ni en diffusion ni en pige.**
5. **Séparation des données** : les coordonnées des **agences** (annonceurs pros) et celles des **particuliers** sont deux catégories distinctes. Ne jamais mélanger : une annonce d'agence n'est pas une piste de prospection.

---

## 3. Fournisseurs d'annonces de particuliers : comparatif

| Fournisseur | Produit et intégration | Données annoncées | Particulier ou pro, coordonnées | Origine des données documentée ? | Prix connus | Lien |
|---|---|---|---|---|---|---|
| **Stream Estate** | API REST, **webhooks** (nouvelles annonces, baisses de prix), serveur MCP. API v1 arrêtée le 31/12/2026, **utiliser la v2** | 50 M+ annonces dédoublonnées, 1 500+ sources selon l'éditeur ; historique des prix | Distinction annoncée par les fiches tierces ; coordonnées **non confirmées** | **Non** (page commerciale seulement) | **À l'usage : 0,01 € par élément. Starter 99 €/mois (15 000 éléments), Growth 399 €/mois, Scale 799 €/mois** (grille officielle) | [stream.estate/pricing](https://stream.estate/pricing) |
| **Melo** (melo.io) | API REST et webhooks ; plusieurs sites tiers disent que l'API est désormais servie par Stream Estate (**lien non confirmé** par Melo) | 1 500+ portails et sites français selon l'éditeur | Non précisé | **Non** | Dès **24 €/mois**, essai 14 jours (site officiel) | [melo.io/api](https://www.melo.io/api/) |
| **Yanport** | Outil « Agent 360 » (pige, prospection) et **API de données facturée à l'usage** ; aucune documentation officielle publique trouvée (un client non officiel cite `api.yanport.com`) | Pige de particuliers et de pros, dédoublonnée et géolocalisée ; DPE ; plus de 30 portails selon des avis | Filtre particulier annoncé ; coordonnées **non confirmées** | **Non** (aucun accord avec les portails publié) | Agent 360 : **39 € HT par utilisateur et par mois** (relevé du 12/11/2026 ; un autre site dit 89 €) ; **API sur devis** | [yanport.com/…/api](https://www.yanport.com/solutions/fournisseur-donnees-immobilieres/api) |
| **Casafari** | API sous contrat (clé, limites fixées au bon de commande), exports, MCP | Annonces de 30 000+ portails et sites d'agences, dédoublonnées ; 20+ pays | Non précisé | Conditions d'approvisionnement publiées, sans liste d'accords | **Sur devis**, essai gratuit | [casafari.com/products/property-data-api](https://www.casafari.com/products/property-data-api) |
| **Pige Online**, **Easymandat** | Outils de pige pour agences (interface) ; **pas d'API connue** | Annonces de particuliers | Coordonnées affichées selon les comparatifs | Non | 29 €/mois et 50 €/mois (comparatif tiers) | voir sources |
| **ChercherTrouver** | **Aucune information trouvée** (ni offre de pige, ni API, ni prix) | — | — | — | — | à vérifier avec vous |
| **Pillr** | Plateforme d'**indicateurs** (prix au m², loyers, rendement, risques par commune) ; **pas de flux d'annonces** trouvé | — | — | — | — | [data.gouv.fr/organizations/pillr](https://www.data.gouv.fr/organizations/pillr/information) |
| Fluximmo, aspirateurs Apify ou RapidAPI | Ils écrivent eux-mêmes qu'ils aspirent Leboncoin, PAP… | Tout, téléphones compris | — | **Aspiration non autorisée** | 1 à 5 $ pour 1 000 annonces | **Exclus** (illégal, D-002) |

**Ce que fournissent vraiment les fournisseurs, d'après les pages publiques** : prix, localisation et coordonnées GPS, surfaces, pièces, type, description, photos (droits à vérifier), date de publication, historique des prix (Stream Estate), lien vers l'annonce d'origine, type de vendeur. Le **nom, le téléphone et l'e-mail du vendeur** ne sont confirmés publiquement par aucun fournisseur légitime : c'est à demander par écrit. Même fournis, ces coordonnées ne permettent pas d'appeler ni d'écrire par e-mail sans accord (voir section 2).

**Recommandation** : envoyer la demande de devis déjà prête (`docs/research/fournisseurs-annonces.md`) à **Yanport** et à **Stream Estate**, et en option à Casafari. Choisir celui qui fournit **par écrit** :
1. l'origine des données et ses accords avec les sources ;
2. une garantie et une indemnisation en cas de réclamation d'un portail ;
3. les droits d'affichage des photos et des textes dans un logiciel commercial ;
4. le statut juridique des coordonnées et un accord de traitement des données (DPA), avec hébergement dans l'UE.

À contrat égal, **Stream Estate** est le plus simple à intégrer (API v2, webhooks, prix publics) ; **Yanport** est le plus connu des agences françaises.

---

## 4. Fournisseurs de multidiffusion : comparatif

| Fournisseur | Intégration dans un logiciel tiers | Ce que l'on sait des fonctions | Documentation publique | Prix connus | Lien |
|---|---|---|---|---|---|
| **Ubiflow** | Passerelle qui « se branche sur votre CRM » ; gère les relations techniques et contractuelles avec des centaines de portails | Diffusion, packs de visibilité ; **pas de documentation d'API publique** trouvée (statuts, contacts entrants, statistiques à confirmer) | **Non** (un seul dépôt GitHub communautaire, non officiel) | Pour une agence : dès **25 € HT/mois par portail** ; packs Initial **45 à 55 €**, Pro **89 à 95 €**, Expert **119 à 135 € HT/mois** par point de vente, avec engagement et **frais d'installation** (montant non public). **Offre éditeur sur devis** | [ubiflow.net](https://www.ubiflow.net/multidiffusion-annonces-immobilieres) |
| **Gédéon** (Studio Net) | Plateforme de flux d'annonces ; **API REST/JSON** et format XML annoncés sur le site officiel ; utilisée « en coulisse » par des logiciels pour exporter vers SeLoger, Leboncoin, Logic-Immo (source tierce) | Import et export d'annonces ; multidiffusion offerte aux partenaires | Page « procédure d'export » publique ; détail de l'API à obtenir | **Sur devis** (aucun prix public trouvé) | [gedeon.im](https://gedeon.im/) |
| **AllYouCanPost** | Mentionne une **API**, un plugin WordPress et la synchronisation avec les logiciels | Rapport de diffusion, statistiques de coût par annonce et par contact | Non trouvée | Pro **9,90 €/mois**, Premium **39,90 €/mois**, Entreprise sur devis ; abonnements aux portails non inclus (site officiel ; affichage des prix peu clair) | [allyoucanpost.com/…/tarifs](https://www.allyoucanpost.com/fr/immobilier/tarifs/) |
| **Weasyflux**, **Immoinov** | Multidiffusion (Immoinov : 38 portails pros) | — | Non trouvée | Sur demande | voir sources |
| **« API Ulysse »** | **Aucune information trouvée** : ni lien avec Gédéon, ni documentation | — | — | — | à vérifier avec vous |
| **En direct, sans passerelle** | Voir le tableau des portails ci-dessous | Format SeLoger « Poliris » **déjà exporté par ImmoPilot** (D-070) | Spécification Poliris 4.09 | Généralement sans frais pour l'éditeur, **à confirmer** ; temps de certification | — |

### Portails : ce qui est vérifié

| Portail | Diffusion depuis un logiciel | Vérifié |
|---|---|---|
| **SeLoger, Logic-Immo, Belles Demeures** (groupe SeLoger) | Oui : flux Poliris par FTP (spécification 4.09, équipe « Relation Partenaires Logiciel »). Une **API** existe aussi pour les éditeurs partenaires (Apimo l'annonce depuis 2025) | Oui (spécification officielle ; annonce d'Apimo) |
| **Leboncoin Immo** | Oui : les pros abonnés diffusent « depuis leur logiciel, via des flux de multidiffusion » (packs d'import lancés en 2024). Pas d'API publique de lecture | Oui (presse spécialisée) ; procédure éditeur à obtenir |
| **Bien'ici, ParuVendu** | Oui, par les passerelles et les logiciels. Offre commune « Convergence » depuis octobre 2025 ; pack cité à 499 € pour 100 annonces | Oui (presse spécialisée) ; format exact à confirmer |
| **Figaro Immobilier** | **Non vérifié** (aucune source trouvée sur sa diffusion depuis un logiciel) | Non |
| **PAP** | **Impossible** : interdit aux professionnels | Oui (conditions d'utilisation de PAP) |

### Comment fonctionnent les abonnements

1. L'**agence** signe son contrat avec chaque portail (Leboncoin, SeLoger, Bien'ici…) et le paie.
2. Le portail lui donne un **identifiant agence** et active la **passerelle** de son logiciel ou de la passerelle choisie (Ubiflow, Gédéon…).
3. Le logiciel envoie un flux (fichier ou API). Le portail publie, modère et retire selon ce flux.
4. **ImmoPilot ne paie aucun abonnement aux portails.** Avec une passerelle, deux formules sont possibles :
   - (a) l'agence a son propre contrat Ubiflow, et ImmoPilot lui envoie les annonces : 0 € pour nous ;
   - (b) contrat « éditeur » d'ImmoPilot avec la passerelle, refacturé ou inclus dans nos formules : sur devis.

**Recommandation** : **Ubiflow** en premier choix pour sa couverture, qui est l'argument des agences. **Gédéon** en alternative pour son API REST publique. Envoyer aux deux une demande de devis « éditeur » avec la liste précise des fonctions attendues (section 6). Retenir celui qui confirme **par écrit** une API pour publier, modifier et retirer, les statuts par portail, les erreurs, les photos et les contacts entrants. En parallèle, demander les **partenariats directs** SeLoger et Leboncoin (e-mails prêts), sans frais d'intermédiaire.

---

## 5. Budget

### Hypothèses

- Agence type : 2 utilisateurs, 30 annonces en vente, 1 à 2 départements à surveiller.
- Données : **Stream Estate** (seule grille publique). Un « élément » correspond à une annonce récupérée ou mise à jour. Les zones de plusieurs agences se recoupent souvent. **Ce n'est qu'une estimation**, à recaler sur le devis.
- Multidiffusion : formule (a), où chaque agence paie sa passerelle, comparée à la formule (b), un contrat éditeur sur devis.
- Abonnements aux portails : toujours payés par l'agence. Ils sont indiqués pour information, ce n'est pas notre coût.

### Coût mensuel pour ImmoPilot

| Agences | 1. Données (Stream Estate) | 2. Multidiffusion, formule (a) | 2 bis. Multidiffusion, formule (b) | 3. Installation, intégration | 4. Portails (payés par l'agence) |
|---|---|---|---|---|---|
| 1 | 99 € (Starter) | 0 € | sur devis | 0 € de prestation externe (développement interne) ; installation Ubiflow non publique | 300 à 900 € par agence |
| 5 | 99 à 399 € (Starter à Growth, selon les zones) | 0 € | sur devis | idem | idem, par agence |
| 10 | 399 € (Growth) | 0 € | sur devis | idem | idem |
| 25 | 399 à 799 € (Growth à Scale) | 0 € | sur devis | idem | idem |
| 50 | 799 € (Scale) ou devis | 0 € | sur devis | idem | idem |

Avec Yanport, le prix de l'API n'est pas public. À titre de repère seulement, son outil Agent 360 coûte 39 € HT par utilisateur et par mois, soit environ 78 € par agence de 2 personnes.

**Côté agence, en formule (a)** : sa passerelle coûte 25 à 135 € HT/mois, plus l'installation. Pour une petite agence avec 5 portails, un comparatif tiers rapporte 100 à 150 € HT/mois. S'y ajoutent ses abonnements aux portails, qu'elle paie déjà aujourd'hui.

**Pour démarrer** : 0 € tant que les devis ne sont pas signés. Ensuite, la première dépense probable est la donnée, 99 €/mois avec Stream Estate Starter. Elle peut être couverte en vendant la pige en option, par exemple 29 €/mois par agence : remboursée dès 4 agences.

---

## 6. Intégration dans le code existant (plan, sans développement)

Rien n'est reconstruit : chaque point s'accroche à un module existant.

### 6.1 Annonces de particuliers

- **Connecteur interchangeable** dans `packages/integrations`, à côté de `ban.ts`, `dvf.ts`… :
  - une interface `ListingsProvider` avec `search(zone, filtres)`, `get(id)` et `changesSince(curseur)` ;
  - un premier adaptateur pour le fournisseur retenu.

  Changer de fournisseur revient à écrire un autre adaptateur.
- **Base de données**, nouvelle migration :
  - `ref.market_listings` : annonces du fournisseur, données publiques du marché, partagées entre agences si le contrat le permet. Colonnes : fournisseur, identifiant, type de vendeur, prix, surfaces, pièces, chambres, type, coordonnées (PostGIS, comme `ref.dvf_sales`), description, URL des photos, date de publication, lien d'origine, mention « agences s'abstenir », dates de mise à jour et de retrait ;
  - `ref.market_listing_contacts` : coordonnées du vendeur, **seulement si le contrat les fournit**. Accès réservé à une fonction de la base qui **journalise chaque consultation**, avec une durée de conservation limitée ;
  - `app.prospects` (sous RLS, par agence) : annonce suivie, favori, responsable, **statut** (à contacter, contacté, en attente, relance à effectuer, rendez-vous obtenu, mandat obtenu, sans suite), notes, prochaine action. Liens vers `app.contacts` et `app.properties` quand le vendeur devient un contact ou que le bien entre en mandat. **Pas de deuxième CRM** : les relances sont des `app.tasks`, l'accord du vendeur va dans `app.contact_consents` ;
  - mise à jour : tâche planifiée quotidienne, ou webhooks du fournisseur reçus sur `/api/v1/annonces-marche/webhook`, signés.
- **Carte** (`app/app/carte/map-view.tsx`, `lib/map/data.ts`) : une 3e couche, « Annonces de particuliers », à côté des biens de l'agence et des ventes DVF, avec les mêmes filtres et le même regroupement.
- **Fiche détaillée** : elle réutilise la fiche annonce (`proprietes/[id]/fiche`) et l'analyse existante :
  - `listingAnalysis` : ventes DVF comparables, estimation, position par rapport au marché ;
  - l'agent « Analyse des annonces » (D-069) : points forts, points faibles, conseils ;
  - lien vers l'annonce d'origine ; coordonnées du vendeur seulement si elles sont autorisées.
- **Boutons de contact** : « Appeler » et « E-mail » n'apparaissent **que si un accord est enregistré** (contrôle déjà présent dans le CRM). Sinon, « Préparer un courrier » et « Ajouter à ma liste ».
- **Coûts techniques** : le fournisseur ; aucun hébergement supplémentaire au départ (Supabase gratuit jusqu'à environ 500 Mo, à surveiller avec le volume des annonces).

### 6.2 Multidiffusion

- **Connecteur interchangeable** : une interface `DiffusionProvider` avec `publish`, `update`, `withdraw`, `status(idExterne)` et `parseWebhook`. Un adaptateur par fournisseur (Ubiflow, Gédéon, flux Poliris direct).
- **Réutilisation de l'existant** :
  - export Poliris 4.09 (D-070), comme contenu envoyé si le fournisseur l'accepte ;
  - contrôle des mentions obligatoires et pack annonce (D-066) ;
  - rédacteur d'annonces IA (D-069) ;
  - suivi par portail `app.property_portals` (D-066), qui devient automatique.
- **Base de données** :
  - ajouter à `app.property_portals` : fournisseur, identifiant externe, statut (en attente, publié, refusé, en erreur, retiré), dernière erreur, statistiques et date de synchronisation ;
  - nouvelle table `app.diffusion_accounts` : par agence, les identifiants agence de chaque portail (non secrets) ;
  - nouvelle table `app.inbound_leads` : contacts entrants reçus d'un portail, rattachés au bien puis transformés en contacts du CRM, avec l'origine « Portail ».
- **Interface** : la partie « Diffusion » de la page Annonce existe déjà. On ajoute :
  - les cases des portails et un bouton « Publier » ;
  - le statut en direct et les erreurs ;
  - dans Paramètres, la saisie des identifiants agence.
- **Sécurité** :
  - la clé API du fournisseur reste côté serveur, en variable d'environnement Vercel (par exemple `UBIFLOW_API_KEY`), jamais dans le navigateur ;
  - webhooks signés ; RLS par agence ; journal d'audit ; aucune donnée de contact envoyée à l'IA.
- **Compatibilité à confirmer avec le fournisseur** : publication par API ou seulement par fichier ; délais de modération ; retour des statuts et des contacts entrants ; encodage du flux ; nombre maximal de photos.

### 6.3 Questions à poser dans les demandes de devis

- **Multidiffusion** :
  1. API pour publier, modifier et retirer ?
  2. Statut par portail et erreurs ?
  3. Webhooks ?
  4. Contacts entrants ?
  5. Statistiques ?
  6. Marque blanche, sans que l'agence voie la passerelle ?
  7. Contrat éditeur ou contrat par agence ?
  8. Frais d'installation et engagement ?
  9. Portails couverts, avec la liste ?
  10. Environnement de test ?
- **Données** : les 10 questions de `docs/research/fournisseurs-annonces.md`, plus :
  - les coordonnées des vendeurs : fournies ? sur quelle base légale ?
  - la mention « agences s'abstenir » est-elle transmise ?

---

## 7. Démarches (rien n'est payé sans votre accord)

| Fournisseur | Démarche | Lien |
|---|---|---|
| Stream Estate | Créer un compte d'essai, demander la confirmation écrite des points juridiques | [stream.estate/pricing](https://stream.estate/pricing) |
| Yanport | Demander un devis pour l'API de données (pige de particuliers) | [yanport.com/…/api](https://www.yanport.com/solutions/fournisseur-donnees-immobilieres/api) |
| Casafari (option) | Demande de démonstration | [casafari.com](https://www.casafari.com/products/property-data-api) |
| Ubiflow | Demande de devis « éditeur partenaire » (e-mail prêt) | [ubiflow.net](https://www.ubiflow.net/multidiffusion-annonces-immobilieres) |
| Gédéon (Studio Net) | Demander la documentation de l'API et un devis | [gedeon.im](https://gedeon.im/) |
| AllYouCanPost (option peu coûteuse) | Vérifier l'API et l'offre Entreprise | [allyoucanpost.com](https://www.allyoucanpost.com/fr/immobilier/tarifs/) |
| SeLoger (direct) | Partenariat éditeur, flux Poliris (e-mail prêt) | partners@groupeseloger.com (adresse de la spécification, à vérifier) |
| Leboncoin Immo (direct) | Demander la procédure « logiciel partenaire » auprès de l'équipe pro | via l'espace pro Leboncoin |

E-mails prêts : `docs/research/fournisseurs-annonces.md` (données) et `docs/partenaires/multidiffusion-ubiflow.md` (passerelles et portails).

---

## Sources

- [Stream Estate : tarifs](https://stream.estate/pricing) · [Stream Estate : API de données](https://stream.estate/real-estate-data-api) · [Stream Estate : guide « API Leboncoin »](https://stream.estate/fr/guides/leboncoin-api)
- [Melo : API](https://www.melo.io/api/) · [Melo : avis et prix (Les Outils Immo)](https://www.lesoutilsimmo.fr/outils/melo) · [Freudix : Melo API](https://freudix.studio/apis/melo)
- [Yanport : API](https://www.yanport.com/solutions/fournisseur-donnees-immobilieres/api) · [Yanport : Agent 360](https://www.yanport.com/solutions/agent-360/pige-et-prospection-immobiliere) · [Les Outils Immo : Yanport](https://www.lesoutilsimmo.fr/outils/yanport) · [Client API non officiel](https://github.com/kevinlansel/yanport-client/blob/master/docs/AnnoncesApi.md)
- [Casafari : API](https://www.casafari.com/products/property-data-api) · [Casafari : conditions d'approvisionnement](https://casafari.com/data-supply-terms-conditions) · [La Fabrique du Net : Casafari](https://www.lafabriquedunet.fr/logiciel/casafari)
- [Logiciels de pige : comparatif (Dimo)](https://www.dimo-diagnostic.net/actualite-diagnostic-immobilier/logiciel-pige-immobiliere) · [Pillr (data.gouv.fr)](https://www.data.gouv.fr/organizations/pillr/information) · [Aspirateurs Apify (exclus)](https://apify.com/dltik/pige-immo-fr-scraper)
- [Ubiflow : multidiffusion](https://www.ubiflow.net/multidiffusion-annonces-immobilieres) · [Ubiflow vs Diffuze 2026](https://www.diffuze.fr/blog/ubiflow-vs-diffuze-comparatif-2026) · [Les Outils Immo : Ubiflow](https://www.lesoutilsimmo.fr/outils/ubiflow) · [Ma Formation Immo : Ubiflow](https://www.maformationimmo.fr/ubiflow/) · [Comparatif-logiciels : Ubiflow](https://www.comparatif-logiciels.fr/logiciel/avis-ubiflow-immobilier/)
- [Gédéon : accueil](https://gedeon.im/) · [Gédéon : procédure d'export](https://gedeon.im/export-procedure) · [ImmoWP : passerelle Gédéon](https://www.immowp.fr/nos-passerelles/gedeon-wordpress)
- [AllYouCanPost : tarifs](https://www.allyoucanpost.com/fr/immobilier/tarifs/) · [AllYouCanPost : fonctionnalités](https://www.allyoucanpost.com/fr/immobilier/fonctionnalites/)
- [Apimo : API Groupe SeLoger](https://apimo.com/en/actualites/seloger-api-simplify-the-management-of-your-real-estate-ads) · [Leboncoin : offres de diffusion par logiciel (2024)](https://www.mysweetimmo.com/2024/09/23/pros-de-limmo-leboncoin-propose-4-nouvelles-solutions-de-diffusion-dannonces/) · [Convergence Bien'ici / ParuVendu](https://www.mysweetimmo.com/2025/10/07/annonces-immobilieres-avec-convergence-nous-voulons-redonner-du-pouvoir-aux-agents-immobiliers-laurent-radix/) · [Bien'ici et ParuVendu : deux mois offerts](https://www.mysweetimmo.com/2026/06/09/immobilier-bienici-et-paruvendu-offrent-deux-mois-de-diffusion-aux-agences/)
- [PAP : conditions d'utilisation](https://www.pap.fr/groupe/cgu)
- [Décret sur la pige téléphonique (MySweetImmo, 05/08/2026)](https://www.mysweetimmo.com/2026/08/05/agents-immobiliers-le-decret-sur-la-pige-telephonique-fixe-les-regles-applicables-des-le-11-aout/) · [Actu Juridique Immobilier](https://actujuridiqueimmobilier.com/2026/07/22/fin-du-demarchage-telephonique-immobilier-les-professionnels-doivent-preparer-lapres-pige/) · [Ce qui reste permis (IA Lab Immo)](https://ia-lab-immo.com/blog/loi-demarchage-telephonique-immobilier-2026) · [Alternatives légales (Elevimmo)](https://elevimmo.fr/blog/pige-immobilier-2026-methodes-legales-apres-11-aout) · [CNIL : prospection par téléphone](https://cnil.fr/fr/prospection-commerciale-par-telephone-hors-automate-dappel-quelles-sont-les-regles)
- [Jinka condamnée face à SeLoger](https://www.mysweetimmo.com/2025/12/17/immobilier-seloger-fait-condamner-jinka-pour-extraction-et-reutilisation-illicites-de-ses-annonces/) · [Jinka condamnée face à Leboncoin](https://www.mysweetimmo.com/2026/04/15/annonces-immobilieres-jinka-condamnee-a-payer-200-000-e-a-leboncoin-en-appel/)
