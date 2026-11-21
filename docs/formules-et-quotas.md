# Formules et quotas dans le logiciel (sans paiement)

Réponse à la question de rentabilité du fondateur : « les agents ne doivent pas me coûter plus que ce que les agences paient ». Chaque formule plafonne ce qui coûte. Au quota, l'action est **refusée avec un message clair**. Elle n'est jamais facturée en douce, et les éléments déjà créés ne sont jamais bloqués ni supprimés.

## Ce qui est construit
- **Grille des formules** (`packages/domain/src/billing/plans.ts`), reprise de la phase 1 (D-014) : Investisseur 19 €, Solo 59 €, Pro 99 €, Agency 249 € HT (3 membres, puis 49 € par membre supplémentaire).
- **Formule de l'agence** (`app.agency_plans`, migration 0016) :
  - attribuée par l'exploitant (procédure dans `docs/deploiement-preprod.md`, section 6) ;
  - l'application peut seulement la lire ;
  - sans attribution, l'agence est en **Essai**.
- **Compteurs** (`app.agency_usage`, migration 0017) :
  - calculés par la base sur toute l'agence, éléments privés compris ;
  - seuls des nombres sortent, jamais un élément privé d'un collègue ;
  - test d'intégration à l'appui.
- **Contrôles** aux quatre points de création :
  - dossier de bien ;
  - contact ;
  - import CSV de contacts (l'aperçu prévient avant l'import) ;
  - invitation d'un membre. Une invitation en attente réserve une place, pour ne pas dépasser le quota au moment où elle est acceptée.
- **Page « Formule et consommation »** (`/app/formule`) :
  - consommation, avec des barres de progression ;
  - date de remise à zéro des quotas mensuels : le 1er du mois à minuit, heure de Paris ;
  - comparaison des formules.

  Aucun bouton « changer de formule » : il n'y aurait rien derrière tant que le paiement n'existe pas.

## Quotas appliqués

| Quota | Essai | Investisseur | Solo | Pro | Agency |
|---|---|---|---|---|---|
| Dossiers de biens par mois | 30 | 10 | 40 | 100 | 250 |
| Échanges avec le Copilot par mois | non inclus | 50 | 200 | 500 | 1 200 |
| Annonces rédigées par IA par mois | non inclus | non incluses | 30 | 80 | 200 |
| Contacts | 500 | 100 | 1 000 | 5 000 | illimités |
| Membres | 5 | 1 | 1 | 1 | 3 + supplémentaires |

Les quotas d'IA s'appliqueront dès que l'IA sera ouverte (D-047). Pour l'instant, la page affiche « IA non activée ».

## Hypothèses à valider par le fondateur
- **Investisseur** : la grille ne fixe ni les contacts ni les membres. Ont été retenus 100 contacts et 1 membre.
- **Essai** : 30 dossiers par mois, 500 contacts, 5 membres, sans IA. C'est un choix de préproduction, à revoir avant le lancement (durée de l'essai, quotas).
- **Solo et Pro** : « 1 utilisateur » est appliqué comme 1 membre (aucune invitation possible).

## Limites connues
- **Contrôle souple** : deux créations exactement simultanées peuvent dépasser le quota d'une unité. Le dépassement possible est minime et ne coûte rien tant que l'IA n'est pas ouverte. Pour l'IA, le contrôle sera strict (réservation avant l'appel au modèle).
- **Acceptation d'une invitation** : la place est réservée à la création de l'invitation. Si la formule baisse entre-temps, l'acceptation reste possible.
- **Aucun paiement** : l'abonnement en ligne (Stripe ou équivalent) demandera un compte externe, donc l'accord du fondateur.

## Tests
- 4 tests unitaires de la grille et du calcul des quotas, plus 3 sur le début de mois à Paris (été, hiver, minuit, changement d'année) ;
- 2 tests d'intégration :
  - l'application lit la formule mais ne peut pas la modifier ;
  - les compteurs couvrent toute l'agence, éléments privés compris, sans fuite vers une autre agence ;
- 1 scénario de bout en bout : une agence en Essai voit sa consommation, puis la 5e invitation est refusée au quota (5 sur 5).
