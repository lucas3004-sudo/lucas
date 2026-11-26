# Demandes de devis à envoyer (validées le 26/11/2026, D-071)

Vous les envoyez vous-même : copiez le texte dans le formulaire de contact du site ou dans un e-mail. Remplacez `[Votre nom]` et ajoutez votre téléphone si vous le souhaitez. **Vous ne vous engagez à rien** : ce sont des demandes d'information.

| À qui | Pour quoi | Où l'envoyer |
|---|---|---|
| **Yanport** | Annonces de particuliers sur la carte | Formulaire de la page [API Yanport](https://www.yanport.com/solutions/fournisseur-donnees-immobilieres/api) |
| **Stream Estate** | Annonces de particuliers sur la carte | Page [tarifs Stream Estate](https://stream.estate/pricing) : bouton de contact ou création d'un compte d'essai |
| **Ubiflow** | Multidiffusion sur les portails | Formulaire de contact de [ubiflow.net](https://www.ubiflow.net/multidiffusion-annonces-immobilieres) |
| **Gédéon (Studio Net)** | Multidiffusion sur les portails | Page contact de [gedeon.im](https://gedeon.im/) |

Je ne cite aucune adresse e-mail : je n'en ai trouvé aucune de confirmée sur les sites officiels. Passez par leurs pages de contact.

Quand une réponse arrive, transférez-la-moi (copier-coller) : je la compare avec la grille de l'étude (`docs/research/etude-fournisseurs-2026-11.md`, section 3 et section 4).

---

## 1. Yanport et Stream Estate (même texte, à envoyer aux deux)

> **Objet** : Devis : accès API aux annonces immobilières de particuliers pour un logiciel d'agences
>
> Bonjour,
>
> Je développe ImmoPilot AI, un logiciel de gestion pour les agents immobiliers indépendants et les petites agences en France (biens, acquéreurs, estimations, annonces). Nous voulons afficher à nos agences, sur une carte, les biens mis en vente par des particuliers dans leur secteur, avec un accès par API.
>
> Avant de parler de prix, nous devons vérifier que la source est conforme. Pourriez-vous nous indiquer :
>
> **Origine et droits**
> 1. D'où viennent vos annonces ? Avez-vous un accord écrit avec chaque portail ou site source ? Sinon, sur quelle base les collectez-vous ?
> 2. Le contrat prévoit-il une garantie et une indemnisation en cas de réclamation d'un portail ou d'un producteur de base de données ?
> 3. Quels usages sont autorisés : affichage à nos agences clientes dans notre logiciel, stockage, statistiques, conservation après la fin du contrat ?
> 4. Les photos et les textes des annonces peuvent-ils être affichés dans notre logiciel ? Sinon, pouvons-nous afficher un lien vers l'annonce d'origine ?
>
> **Données personnelles**
> 5. Distinguez-vous les annonces de particuliers de celles des professionnels ? Transmettez-vous la mention « agences s'abstenir » ?
> 6. Fournissez-vous les coordonnées des vendeurs ? Si oui, sur quelle base légale (RGPD) ? Pouvons-nous recevoir les annonces sans ces coordonnées ? (Depuis le 11/08/2026, le démarchage téléphonique exige le consentement préalable du particulier.)
> 7. Où sont hébergées les données (Union européenne ?) ? Fournissez-vous un accord de traitement des données (DPA) ?
>
> **Technique**
> 8. Couverture (toute la France ?), délai de mise à jour, dédoublonnage, historique des prix, détection des annonces retirées.
> 9. Recherche par zone géographique, webhooks (nouvelle annonce, baisse de prix, retrait), quotas, limites de débit, disponibilité garantie.
> 10. Existe-t-il un accès d'essai ou un environnement de test ?
>
> **Prix**
> 11. Votre grille complète (volume inclus, dépassement, engagement minimum) et une estimation pour 1, 5, 10, 25 et 50 agences clientes, chacune suivant un ou deux départements.
> 12. Pouvons-nous intégrer ce service dans nos formules et le refacturer à nos agences ? Proposez-vous un tarif de lancement ?
>
> Nous ne prenons aucun engagement à ce stade. Merci par avance,
>
> [Votre nom], ImmoPilot AI

---

## 2. Ubiflow et Gédéon (même texte, à envoyer aux deux)

> **Objet** : Partenariat éditeur : diffusion des annonces de nos agences par votre passerelle
>
> Bonjour,
>
> Je développe ImmoPilot AI, un logiciel de gestion pour les agents immobiliers indépendants et les petites agences en France (biens, mandats, acquéreurs, estimations, annonces avec contrôle des mentions obligatoires). Nous produisons déjà un flux au format Poliris 4.09.
>
> Nos agences veulent publier leurs annonces sur les portails directement depuis ImmoPilot, sans jamais quitter notre logiciel. Chaque agence garderait **son propre contrat** avec vous et avec les portails. Pourriez-vous nous indiquer :
>
> **Connexion**
> 1. Les conditions de votre programme pour les éditeurs de logiciels : frais éventuels pour l'éditeur, engagement, certification.
> 2. Existe-t-il une **API** pour publier, modifier et retirer une annonce ? Sinon, quel format de flux (Poliris, XML…) et quel mode d'envoi (FTP, HTTPS) ? Avez-vous un environnement de test ?
> 3. Recevons-nous, pour chaque annonce et chaque portail, le **statut** (en attente, publiée, refusée, en erreur) et le **motif des refus** ? Par webhook ou par appel ?
> 4. Les **contacts reçus** par les portails (demandes d'acquéreurs) peuvent-ils nous être transmis, rattachés à l'annonce ?
> 5. Les **statistiques** par annonce et par portail (vues, contacts) sont-elles disponibles ?
> 6. Nombre maximal et format des photos ; délai de mise en ligne et de retrait.
> 7. Le service peut-il fonctionner **sans que l'agence ait à se connecter chez vous** au quotidien (tout piloté depuis notre logiciel) ?
>
> **Portails et agences**
> 8. La liste des portails couverts, en particulier Leboncoin, SeLoger, Logic-Immo, Bien'ici, Figaro Immobilier et ParuVendu.
> 9. Ce que l'agence doit souscrire chez vous : prix mensuel, frais d'installation, engagement. Comment ses abonnements aux portails sont-ils rattachés ?
>
> **Données personnelles**
> 10. Où sont hébergées les données (Union européenne ?) ? Proposez-vous un accord de traitement des données (DPA) ?
>
> Nous ne prenons aucun engagement à ce stade. Merci par avance,
>
> [Votre nom], ImmoPilot AI
