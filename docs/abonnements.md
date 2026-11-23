# Abonnements, essai gratuit et paiement (D-057)

## Parcours
1. **Page d'accueil publique** (`/`) : présentation, captures, formules avec leurs prix et quotas, bouton « Essayer gratuitement 14 jours ».
2. **Inscription** puis création de l'agence : l'**essai de 14 jours** commence, toutes les fonctions sont ouvertes avec les quotas « Essai ». Un bandeau indique les jours restants au gérant.
3. **Page « Abonnement »** (`/abonnement`) :
   - état de l'essai ou de l'abonnement ;
   - les 4 formules ;
   - un bouton « Choisir » qui ouvre le paiement sécurisé Stripe, réservé au gérant ;
   - « Gérer l'abonnement » ouvre le portail Stripe : factures, carte, résiliation.
4. **Après l'essai**, sans abonnement payé, le logiciel redirige vers `/abonnement`. Rien n'est supprimé.
5. **Paiement en échec** : 7 jours de grâce avec un bandeau, puis blocage. Les données restent conservées.

## Sécurité
- Les numéros de carte ne passent jamais par ImmoPilot : ils sont saisis chez Stripe.
- Les événements Stripe sont acceptés seulement avec une **signature valide**.
- Un abonnement ne peut être écrit que par la fonction `app.apply_subscription` : le site peut lire l'abonnement, jamais le modifier directement (testé).
- La formule payée fixe les quotas (`app.agency_plans`, D-048). Une résiliation ramène l'agence aux quotas par défaut.
- Chaque ouverture du paiement ou du portail est inscrite au journal d'audit.

## Tests
- 4 tests unitaires de la règle d'accès : essai, abonnement, grâce, résiliation.
- 3 tests unitaires de la conversion Stripe vers ImmoPilot : statuts, formule, agence.
- 2 tests d'intégration : écriture interdite au site, idempotence, résiliation, agence inconnue.
- 1 scénario de bout en bout : page d'accueil, inscription, bandeau d'essai, page « Abonnement ». Sans clé Stripe, le paiement est annoncé « en cours d'activation ».

## Reste à faire avec le fondateur
- Créer le compte Stripe et transmettre la clé de test par le formulaire sécurisé.
- Créer les 4 prix et le point de réception, puis faire un essai complet avec la carte de test de Stripe.
- Passage au paiement réel, après validation.
