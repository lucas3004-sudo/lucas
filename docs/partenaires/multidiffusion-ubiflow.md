# Multidiffusion : demande de partenariat (Ubiflow ou équivalent)

- **Date** : 23 novembre 2026
- **Décision du fondateur (23/11/2026)** : « Pack annonce maintenant + passerelle ». Aucun engagement ni paiement sans son accord.

## Comment les agences publient aujourd'hui

1. L'agence saisit le bien **une seule fois** dans son logiciel de transaction.
2. Le logiciel envoie l'annonce, sous forme de **flux** (fichier XML ou format « Poliris »), vers les portails choisis : SeLoger, Leboncoin, Bien'ici, Logic-Immo, le site de l'agence…
3. Chaque portail est **payé par l'agence** avec son propre abonnement (de 300 à 900 € par mois au total selon le volume, d'après les éditeurs).
4. Quand le bien est vendu, le logiciel retire l'annonce partout.

Une **passerelle de multidiffusion** comme Ubiflow sert d'intermédiaire. Le logiciel lui envoie un seul flux, et elle s'occupe des accords techniques et contractuels avec des centaines de portails. C'est la voie la plus rapide pour ImmoPilot, au lieu de négocier avec chaque portail un par un.

## Ce qui existe déjà dans ImmoPilot (D-066)

- **Pack annonce** : le titre et la description prêts à coller, avec les mentions obligatoires vérifiées (DPE, honoraires, copropriété, Géorisques), et un fichier ZIP avec le texte et toutes les photos.
- **Suivi de la diffusion** : les portails où chaque bien est en ligne, le lien de l'annonce, la date. Quand le bien est vendu ou retiré, un rappel est créé pour retirer chaque annonce.

## Prix observés (recherche du 26/11/2026, à confirmer par devis)

- Diffusion vers un seul portail : dès **25 € HT/mois** par passerelle (site d'Ubiflow, cité par les comparatifs).
- Packs multi-portails, par point de vente, avec engagement et frais d'installation : Initial **45 à 55 €**, Pro **89 à 95 €**, Expert **119 à 135 € HT/mois** (les comparatifs ne concordent pas).
- Coût constaté pour une petite agence (environ 30 biens, 5 portails) : **100 à 150 € HT/mois** pour Ubiflow seul, selon un comparatif publié par un concurrent (Diffuze).
- Les abonnements aux portails ne sont pas inclus. Aucun tarif « éditeur » public : devis nécessaire.

## Ce qui est prêt depuis le 26/11/2026 (D-070)

- **Export au format SeLoger « Poliris » 4.09** (page « Biens », gérant et managers). Il produit un ZIP avec `Annonces.csv` (329 champs par annonce), `Config.txt`, `Photos.cfg` et les photos.
- Seuls les biens sous mandat dont les mentions obligatoires sont complètes y figurent.
- C'est le format qu'acceptent SeLoger, Logic-Immo et la plupart des passerelles. Il reste à le **brancher** : identifiant agence fourni par le portail ou la passerelle, et mode d'envoi (FTP ou HTTPS).

## E-mail aux portails, en direct (par vous)

À envoyer à l'équipe Partenaires Logiciel de SeLoger (adresse indiquée dans sa spécification technique : partners@groupeseloger.com, à vérifier). À adapter pour Leboncoin Immo et Bien'ici.

> **Objet** : Demande de partenariat éditeur, flux d'annonces Poliris
>
> Bonjour,
>
> Je développe ImmoPilot AI, un logiciel de gestion pour les petites agences immobilières en France. Notre logiciel produit déjà un export de leurs annonces au format Poliris 4.09 (Annonces.csv, Config.txt, Photos.cfg, photos jointes).
>
> Nous souhaitons devenir éditeur partenaire pour que nos agences clientes, abonnées chez vous, diffusent leurs annonces directement depuis ImmoPilot. Pourriez-vous nous indiquer :
> 1. la procédure de certification d'une nouvelle passerelle et l'environnement de test disponible ;
> 2. le mode d'envoi attendu (FTP, HTTPS) et la fréquence ;
> 3. l'encodage attendu pour Annonces.csv ;
> 4. les éventuels frais pour l'éditeur ;
> 5. la marche à suivre pour activer le flux d'une agence (identifiant agence).
>
> Merci par avance,
>
> [Votre nom] — ImmoPilot AI

## Questions à poser à la passerelle

1. Proposez-vous un **programme partenaire pour les éditeurs de logiciels** ? Quelles conditions (frais, engagement, certification) ?
2. **Format du flux** attendu (spécification XML, Poliris, API) et mode d'envoi (FTP, HTTPS, API). Avez-vous un environnement de test ?
3. **Portails couverts** (SeLoger, Leboncoin, Bien'ici, Logic-Immo…) et délai de mise en ligne.
4. **Côté agence** : faut-il qu'elle ait son propre compte chez vous ? Quel prix pour elle ? Comment saisit-elle ses codes ou abonnements portails ?
5. **Retours** : renvoyez-vous les statistiques (vues, contacts reçus) et les erreurs de diffusion (annonce refusée, mention manquante) ?
6. **Données personnelles** : où sont hébergées les données (UE ?), proposez-vous un accord de traitement des données (DPA) ?

## E-mail à envoyer (par vous)

> **Objet** : Partenariat éditeur — envoi d'annonces immobilières vers votre passerelle de multidiffusion
>
> Bonjour,
>
> Je développe ImmoPilot AI, un logiciel de gestion pour les agents immobiliers indépendants et les petites agences en France (biens, mandats, acquéreurs, estimations, annonces avec contrôle des mentions obligatoires).
>
> Nos clients souhaitent diffuser leurs annonces sur les portails directement depuis ImmoPilot. Nous aimerions devenir éditeur partenaire de votre passerelle. Pourriez-vous nous indiquer :
> 1. les conditions de votre programme partenaire pour les éditeurs de logiciels (frais, engagement, certification) ;
> 2. le format du flux attendu (spécification XML, Poliris ou API), le mode d'envoi, et s'il existe un environnement de test ;
> 3. la liste des portails couverts et le délai de mise en ligne ;
> 4. ce que l'agence doit souscrire de son côté (compte, tarif, abonnements aux portails) ;
> 5. les retours disponibles (statistiques, erreurs de diffusion) ;
> 6. l'hébergement des données et votre accord de traitement des données (DPA).
>
> Nous ne prendrons aucun engagement à ce stade. Merci par avance,
>
> [Votre nom] — ImmoPilot AI

## Sources
- [Ubiflow : diffusion des annonces](https://www.ubiflow.net/diffusion-annonces-vers-immo-route-diff-2462.htm)
- [Leboncoin : offres de diffusion pour les annonces envoyées par logiciel (2024)](https://www.mysweetimmo.com/2024/09/23/pros-de-limmo-leboncoin-propose-4-nouvelles-solutions-de-diffusion-dannonces/)
- [Coût des abonnements aux portails (éditeur, 2026)](https://kolonell.com/fr/blog/prix-logiciel-agence-immobiliere-gestion-locative-transaction-2026)
- [Principe de la multidiffusion (Appvizer)](https://www.appvizer.fr/magazine/construction/promoteurs/multidiffusion-annonces-immobilieres)
