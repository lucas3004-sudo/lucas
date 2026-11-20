# Fiche juridique — phase 1

- **Date** : 20 novembre 2026
- **Statut** : **document de travail, pas un avis juridique.** Il prépare la consultation d'un avocat avant la commercialisation. Les sources sont souvent des guides professionnels : chaque règle doit être confirmée dans le texte officiel (Légifrance, EUR-Lex).

## 1. Règles qui s'appliquent directement au produit

### 1.1 Mentions obligatoires des annonces de vente (pour le Listing Copywriter et le contrôle automatique)

| Mention | Base (à confirmer) | Contrôle prévu dans ImmoPilot |
|---|---|---|
| Classe énergie **et** classe climat du DPE | Code de la construction et de l'habitation (CCH) ; tableau UNIS de février 2026 | Blocage de la publication si elles manquent |
| Estimation des dépenses annuelles d'énergie (fourchette) et année de référence des prix | En vigueur depuis 2022 selon les guides | Champ obligatoire, repris du DPE |
| Mention « logement à consommation énergétique excessive » pour les classes F et G | Loi Climat et résilience | Ajoutée automatiquement selon la classe |
| Renvoi vers Géorisques, avec la formule type | Tableau UNIS de février 2026 | Ajouté automatiquement |
| Copropriété : statut, nombre de lots, charges annuelles moyennes, procédure en cours éventuelle | Arrêté du 10 janvier 2017 et CCH | Champs obligatoires si le bien est en copropriété |
| Honoraires : à la charge de qui, prix affiché honoraires inclus ou non, pourcentage, lien vers le barème | Arrêté du 10 janvier 2017 (**texte à vérifier, le résultat de recherche ne l'a pas confirmé**) | Champs obligatoires, vérifiés avant export |

**Règle permanente du Listing Copywriter** : il ne modifie jamais une caractéristique du bien (surface, DPE, nombre de pièces…). Il reformule seulement à partir des données saisies, pour éviter toute pratique commerciale trompeuse.

**DPE 2026** : depuis le 1er janvier 2026, le coefficient de conversion de l'électricité est passé de 2,3 à 1,9. Les DPE établis avant 2026 restent valables, mais la classe d'un logement chauffé à l'électricité peut s'être améliorée. Le produit affiche donc la date du DPE et signale un reclassement possible.

### 1.2 Prospection et démarchage (CRM, Follow-up Agent, Lead Acquisition Agent)

| Canal | Règle | Comportement d'ImmoPilot |
|---|---|---|
| Téléphone vers un particulier | **Consentement préalable obligatoire depuis le 11/08/2026** (loi n° 2025-594, art. L223-1 du Code de la consommation ; décret d'application de juillet 2026). Exception pour les appels liés à un contrat en cours | Champ « consentement » par contact (date, preuve, canal, expiration). L'agent IA ne propose jamais d'appel de prospection sans consentement valide |
| E-mail ou SMS vers un particulier | Consentement préalable (art. L34-5 du CPCE) | Même champ. Tout envoi est une action L3, validée par l'utilisateur |
| Relation existante (client, mandant) | Régime plus souple, à préciser par l'avocat | Statut de la relation enregistré dans le CRM |

### 1.3 RGPD : rôles et obligations d'ImmoPilot

- **Qualification** : pour le CRM, l'agence est **responsable de traitement** et ImmoPilot est **sous-traitant**. La CNIL cite précisément l'exemple du CRM en cloud. ImmoPilot est en revanche responsable de traitement pour ses propres données de clients (facturation, comptes) et pour l'espace particuliers.
- **Obligations de sous-traitant** (art. 28) :
  - contrat de sous-traitance (DPA) couvrant les instructions, la confidentialité, la sécurité, les sous-traitants ultérieurs, l'assistance, la suppression en fin de contrat et les audits ;
  - **liste des sous-traitants ultérieurs** : hébergeur, Anthropic (IA), Stripe, envoi d'e-mails.
- **Point d'attention, l'apprentissage du système.** Le cahier des charges demande que le système « apprenne des résultats ». **Utiliser les données d'un client pour améliorer le service de tous ferait d'ImmoPilot un responsable de traitement (ou co-responsable) pour ces données.** Ce serait contraire à son rôle de sous-traitant. Règles :
  - l'apprentissage reste **à l'intérieur de chaque organisation** ;
  - au niveau global, on n'utilise que des **métriques anonymisées et agrégées** ;
  - aucune donnée client ne sert à entraîner un modèle ;
  - cela renforce la décision D-006.
- **Transferts hors UE** : Anthropic est une société américaine. Il faut vérifier les garanties (DPA, clauses contractuelles types ou certification) et minimiser les données personnelles envoyées au modèle (pseudonymisation des contacts quand c'est possible).

### 1.4 AI Act (règlement UE 2024/1689), article 50, applicable depuis le 2 août 2026

| Obligation | Application à ImmoPilot | Mesure |
|---|---|---|
| Informer qu'on échange avec une IA (art. 50(1), fournisseur) | Copilot, et tout assistant exposé à un utilisateur ou à un particulier | Mention visible et permanente dans l'interface |
| Marquage lisible par machine des contenus générés (art. 50(2), fournisseur) | Annonces, descriptions, e-mails rédigés par l'IA | Métadonnée « généré par IA » sur chaque contenu, et mention à l'export. Une exception existe pour l'« assistance à l'édition standard » et un cas « interentreprises » est envisagé par les lignes directrices : **interprétation restrictive selon la Commission, à analyser par l'avocat** |
| Sursis au 2 décembre 2026 | Seulement pour les systèmes mis sur le marché avant le 2 août 2026 : **ne concerne pas ImmoPilot** | Conformité dès le lancement |
| Systèmes à haut risque (annexe III) | Évaluer la solvabilité de personnes physiques relève du haut risque | Le simulateur de budget reste une simulation pilotée par l'utilisateur, jamais une note de solvabilité |

À vérifier : une source mentionne une version consolidée issue du paquet « omnibus numérique » (règlement (UE) 2026/1744). Il faut confirmer le texte en vigueur avant de le citer.

### 1.5 Données DVF
- Interdiction de réidentifier les personnes (art. R112 A-3 du Livre des procédures fiscales) et pas d'indexation par les moteurs de recherche externes. Voir la décision D-007.

### 1.6 Bases de données des portails
- Droit *sui generis* du producteur : l'extraction **et** la réutilisation sont interdites (Leboncoin c/ Entreparticuliers 2021-2022 ; Jinka c/ SeLoger, CA Versailles, 16/12/2025 ; Jinka c/ Leboncoin, 200 000 € en appel, avril 2026). Voir les décisions D-002 et `docs/research/fournisseurs-annonces.md`.

### 1.7 Non-discrimination (Smart Matching)
- Liste fermée de critères autorisés. Aucun critère lié à l'origine, la religion, la situation de famille, le handicap, l'âge, etc. (art. 225-1 du Code pénal). Les critères de « style de vie » se limitent au bien et à son environnement (transports, écoles, calme, extérieur…).

## 2. Questions à poser à l'avocat

1. **Loi Hoguet, espace particuliers** : une plateforme qui met en relation des particuliers avec des agences, avec une rémunération (abonnement des agences, commission ou prix par contact), relève-t-elle de l'entremise immobilière qui exige une carte T ? D'après les sources consultées, la jurisprudence s'attache à la **réalité et à l'habitude** de l'activité, pas à l'intitulé (Cass. 1re civ., 1er juillet 2020). Quel modèle de rémunération reste hors du champ ?
2. **AI Act art. 50(2)** : les annonces rédigées par l'IA puis relues et validées par l'agent immobilier entrent-elles dans l'exception d'« assistance à l'édition standard » ou dans le cas « interentreprises » ? Sous quelle forme faut-il marquer le texte ?
3. **Prospection** : quel régime s'applique quand un agent immobilier contacte un particulier vendeur qui a publié une annonce, sans consentement préalable, depuis le 11/08/2026 ?
4. **RGPD** : validation du modèle de DPA, des garanties de transfert vers Anthropic, et des durées de conservation par type de contact (prospect, client, mandant).
5. **Simulations d'investissement et fiscales** : quelles limites pour rester hors du conseil en investissement financier (statut CIF) et du conseil fiscal ? Quelles mentions afficher ?
6. **Estimation** : quelle formulation pour l'« estimation indicative » afin d'éviter toute confusion avec une expertise ou un avis de valeur engageant ?
7. **DVF** : des statistiques agrégées par commune (médianes, nombre de ventes), publiées en accès libre, respectent-elles la condition de non-indexation ?
8. **CGU et CGV** : clauses de limitation de responsabilité pour les contenus générés par l'IA.
9. **Droit du travail, tableau de bord du gérant** (ajouté avec la cible « petites agences », D-015) : afficher l'activité commerciale par négociateur salarié (rendez-vous, relances, affaires) impose-t-il une information préalable des salariés ou du CSE ? Quelles limites respecter pour ne pas en faire un dispositif de surveillance ?
10. **Registre des mandats** : à quelles conditions un registre tenu sous forme électronique est-il valable ? (ImmoPilot ne le gère pas au MVP, mais les agences le demanderont.)

## Sources
- [UNIS : tableau des mentions obligatoires des annonces de vente (février 2026)](https://www.unis-immo.fr/app/uploads/2026/02/tableau-annonces-ventes-mentions-obligatoires-090226-2.pdf)
- [Service-public.gouv.fr : DPE](https://www.service-public.gouv.fr/particuliers/vosdroits/F16096)
- [CNIL : qualifications pour les acteurs du cloud](https://www.cnil.fr/fr/quelles-qualifications-pour-les-acteurs-de-linformatique-en-nuage-cloud)
- [CNIL : bien identifier son rôle](https://www.cnil.fr/fr/rgpd-comment-bien-identifier-son-role)
- [CNIL : guide du sous-traitant (PDF)](https://www.cnil.fr/sites/default/files/atoms/files/rgpd-guide_sous-traitant-cnil.pdf)
- [Analyse : éditeur SaaS et co-responsabilité](https://www.donneespersonnelles.fr/rgpd-editeur-saas)
- [CNIL : prospection téléphonique](https://cnil.fr/fr/prospection-commerciale-par-telephone-hors-automate-dappel-quelles-sont-les-regles)
- [Commission européenne : FAQ article 50](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act)
- [Commission européenne : lignes directrices sur les contenus générés](https://digital-strategy.ec.europa.eu/policies/guidelines-transparency-ai-generated-content)
- [AI Act Service Desk : article 50](https://ai-act-service-desk.ec.europa.eu/fr/ai-act/article-50)
- [Victoris Avocat : apporteur d'affaires et carte T](https://www.victorisavocat.com/blog/apporteur-affaires-immobilier-carte-t-loi-hoguet)
- [Actu-Juridique : Airbnb devant la CJUE](https://www.actu-juridique.fr/droit-europeen-ue/la-plate-forme-airbnb-devant-la-cour-de-justice-de-lunion-europeenne-linstrument-prend-le-pas-sur-la-matiere/)
