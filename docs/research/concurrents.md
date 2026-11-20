# Étude concurrentielle — phase 1

- **Date** : 20 novembre 2026
- **Méthode** : recherches web (comparatifs 2026, presse spécialisée, annuaires de logiciels, sites d'éditeurs)
- **Limite importante** : la plupart des éditeurs ne publient pas leurs prix. Les tarifs ci-dessous proviennent de comparatifs tiers et doivent être confirmés auprès des éditeurs. Aucun produit n'a été testé en main propre.

## 1. Paysage

Le marché se divise en quatre familles. ImmoPilot se situe à leur intersection.

| Famille | Acteurs | Ce qu'ils vendent | Leur force | Leur faiblesse pour nous |
|---|---|---|---|---|
| **Logiciels de transaction / CRM d'agence** | Hektor (La Boîte Immo), Apimo, Modelo (ex-Netty, Septeo), outils internes des réseaux | Gestion des biens, mandats, contacts, **multidiffusion vers les portails**, documents, reporting | Installés dans les agences, coût de changement élevé | IA ajoutée après coup, à des degrés très inégaux |
| **Données et estimation pour pros** | Yanport, PriceHubble, Casafari, MeilleursAgents Pro, RealAdvisor | Pige, estimation, études de marché, historique d'annonces | **Historique d'annonces** (une donnée que nous n'avons pas) | Outils d'analyse, pas d'orchestration du travail de l'agent |
| **Outils investisseurs** | LyBox, Horiz.io (ex-Rendement Locatif) | Recherche de biens rentables, simulation de rentabilité et de fiscalité, gestion locative | Prix bas (9 à 59 €/mois), pédagogie | Destinés aux particuliers, peu d'outils professionnels |
| **Agrégateurs grand public** | Jinka, MoteurImmo, Pretto Search | Alertes, recherche multi-portails | Audience B2C | **Risque juridique avéré** (voir 3) |

## 2. Fiches concurrents

| Acteur | Prix observé (source tierce, à confirmer) | IA | Points notables |
|---|---|---|---|
| **Hektor** (La Boîte Immo) | Dès environ 79 € HT/mois ; offres Premium et Enterprise sur devis ; modules optionnels payants | Sources contradictoires : « Hektor Voice », assistant présenté en 2024 ; fonctions IA citées dans l'offre Enterprise | Logiciel complet : biens, mandats, contacts, pige, **multidiffusion**, documents juridiques, reporting |
| **Apimo** | 89 €/mois (« CRM AI »), 139 €/mois (« CRM AI+ ») ; HT ou TTC et par utilisateur ou par agence non précisés | Rédaction d'annonces, home staging assisté, automatisations ; couche IA plus large annoncée pour 2027 | Seul éditeur du groupe avec un prix public ; présent aussi en Belgique, au Luxembourg et en Italie |
| **Modelo** (ex-Netty, Septeo) | Sur devis | « MIA », IA présentée comme souveraine (modèles propres), orientée vers les tâches réglementaires (lutte anti-blanchiment, RGPD) ; nouvelle version présentée à RENT 2026 | Groupe Septeo (logiciels juridiques et immobiliers) ; plateforme multi-métiers présentée en octobre 2026 ; actes en ligne intégrés |
| **Yanport** | Agent 360 : **39 € HT par utilisateur et par mois**, sans engagement, prix dégressif (relevé du 12/11/2026) | Agents autonomes pour la pige et la prospection ; argumentaire vendeur rédigé à partir de l'estimation | Données d'annonces et de ventes ; partenariat avec iad (2024) ; observatoire des marchés (2025) |
| **PriceHubble** | Sur devis (quotas, durée d'engagement) | Suite de 3 agents (2026) : Companion (relation client), Copilot (processus), Analyst (marché) ; agent vocal de qualification des leads (septembre 2025) | Acteur européen de la donnée et de l'estimation ; **le concurrent le plus proche de notre vision multi-agents** |
| **Casafari** | Non public, essai gratuit | API, exports, serveurs MCP | Données d'annonces dédoublonnées dans 16 pays ; pige, estimation |
| **LyBox** | 9 à 59 €/mois | Analyse automatique de rentabilité et de fiscalité | Investisseurs locatifs particuliers et professionnels |
| **Horiz.io** | 9 €/mois (1 bien) ou 19 €/mois (illimité) selon un comparatif ; offre gratuite pour le simulateur | — | Simulation et gestion locative pour particuliers |
| **Fichier AMEPI / Amanda** | Adhésion (association) | — | Partage de mandats exclusifs entre agences : plus de 3 300 agences en 2025, flux reçus de 60 éditeurs de logiciels |

## 3. Enseignements

1. **Personne ne vend encore une « équipe d'agents » complète et transparente pour l'agent immobilier indépendant.** PriceHubble s'en approche le plus, mais avec une offre sur devis orientée vers les grands comptes. **Notre fenêtre d'opportunité porte sur les indépendants et les petites agences**, avec des prix publics et clairs.
2. **La donnée « annonces » est le fossé défensif de Yanport, PriceHubble et Casafari.** Nous ne pouvons pas les battre sur ce terrain. Notre différenciation doit venir de :
   - l'**automatisation du travail** : préparer un rendez-vous, rédiger, relancer, faire correspondre biens et acheteurs, suivre une transaction ;
   - l'**explicabilité** : chaque chiffre est sourcé et daté, et le niveau de confiance est affiché ;
   - le **prix** et la simplicité.
3. **Le scraping est désormais un risque judiciaire avéré, pas théorique.** Jinka a été condamnée :
   - au profit de SeLoger : cour d'appel de Versailles, 16 décembre 2025, pour atteinte aux droits du producteur de bases de données ;
   - au profit de Leboncoin : 200 000 € en appel en avril 2026 ;
   - pour pratique commerciale trompeuse à cause de son slogan « 1 app, tous les sites immobiliers ».

   Cela confirme la décision D-002.
4. **Le modèle licite d'agrégation, c'est la diffusion volontaire par les agences.** Exemples : le Fichier AMEPI, qui reçoit les flux de 60 éditeurs, et l'offre « Jinka Free » de référencement gratuit pour les agences (novembre 2026). Une piste pour plus tard serait de permettre aux agences utilisatrices d'ImmoPilot de partager volontairement leurs mandats entre elles. **Cette idée est à soumettre au Council en phase 7, pas maintenant.**
5. **Repères de prix** : les CRM d'agence tournent autour de 79 à 139 €/mois, Yanport à 39 € HT par utilisateur, les outils investisseurs à 9 à 59 €/mois. Les hypothèses de départ (Solo 79 €, Pro 149 €, Agency 299 €) sont dans la fourchette haute pour un nouvel entrant **sans multidiffusion**. Elles sont réexaminées dans `docs/phase-1-strategie.md`.
6. **La multidiffusion est le verrou des agences.** Sans elle, une agence ne quitte pas son logiciel de transaction. Le positionnement « copilote à côté du logiciel existant », avec import des mandats et des contacts, est donc confirmé pour le MVP.

## Sources
- [Hackceleration : meilleur CRM immobilier 2026](https://hackceleration.com/fr/labs/meilleur/crm-immobilier)
- [Hackceleration : meilleur logiciel d'agence 2026](https://www.hackceleration.com/fr/labs/meilleur/logiciel-agence-immobiliere)
- [Capterra : Hektor](https://www.capterra.fr/software/207601/hektor)
- [Hektor Voice (La Boîte Immo)](https://la-boite-immo.com/sites/default/files/2024-05/hektor-voice.pdf)
- [Tensoria : outils IA pour agences](https://tensoria.fr/blog/top-outils-ia-agence-immobiliere)
- [MySweetImmo : Septeo, IA souveraine Modelo (nov. 2026)](https://www.mysweetimmo.com/2026/11/09/proptech-septeo-ia-souveraine-modelo/)
- [La Fabrique du Net : Yanport](https://www.lafabriquedunet.fr/logiciel/yanport)
- [MySweetImmo : partenariat iad × Yanport](https://www.mysweetimmo.com/2024/09/30/proptech-iad-noue-un-partenariat-avec-yanport/)
- [PriceHubble : suite d'agents IA](https://www.pricehubble.com/fr/pricehubble-news/suite-agents-ia)
- [PriceHubble : les agents IA (page en allemand)](https://www.pricehubble.com/at/pricehubble-news/die-ki-agenten-von-pricehubble)
- [La Fabrique du Net : Casafari](https://www.lafabriquedunet.fr/logiciel/casafari)
- [Avis LyBox](https://investissement-locatif-avis.fr/lybox-avis/)
- [Avis Horiz.io](https://investissement-locatif-avis.fr/horiz-io-avis/)
- [MySweetImmo : Jinka condamnée face à SeLoger](https://www.mysweetimmo.com/2025/12/17/immobilier-seloger-fait-condamner-jinka-pour-extraction-et-reutilisation-illicites-de-ses-annonces/)
- [MySweetImmo : Jinka condamnée à 200 000 € (Leboncoin)](https://www.mysweetimmo.com/2026/04/15/annonces-immobilieres-jinka-condamnee-a-payer-200-000-e-a-leboncoin-en-appel/)
- [MySweetImmo : Jinka, pratique commerciale trompeuse](https://www.mysweetimmo.com/2026/07/02/annonces-immobilieres-jinka-condamnee-pour-pratique-commerciale-trompeuse-face-a-seloger/)
- [MySweetImmo : Jinka Free](https://www.mysweetimmo.com/2026/11/04/annonces-immobilieres-cout-jinka-free/)
- [MySweetImmo : le Fichier AMEPI devient Amanda](https://www.mysweetimmo.com/2025/06/24/immobilier-le-fichier-amepi-devient-amanda/)
