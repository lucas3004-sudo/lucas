# Compte rendu de visite (F9, partie sans IA)

Après une visite, le négociateur rend compte au vendeur. Le logiciel produit ce texte à partir de quelques réponses, **sans IA** et sans reformulation. Le texte ne contient jamais l'identité des visiteurs.

## Parcours
1. **Agenda** : les visites passées des 30 derniers jours sans compte rendu sont listées en tête (« Visites sans compte rendu »). Dans la liste des rendez-vous, chaque visite passée a un bouton « Rédiger le compte rendu ».
2. **Formulaire** (`/app/agenda/<visite>/compte-rendu`), avec :
   - l'intérêt des visiteurs (fort, moyen, faible, aucun) ;
   - l'avis sur le prix (facultatif) ;
   - la suite envisagée (offre, seconde visite, réflexion, abandon) ;
   - les points appréciés et les réserves exprimées, en texte libre.

   Le compte rendu se rédige après la visite, jamais avant, et jamais sur une visite annulée.
3. **Texte pour le vendeur** : il est assemblé à partir des réponses et signé du nom de l'utilisateur, avec un bouton « Copier le texte ». Les champs libres sont repris tels quels, et un rappel demande de ne pas y écrire le nom des visiteurs.
4. **Fiche du bien** : synthèse des visites (intérêt fort, offres envisagées, réserves sur le prix), puis les dix derniers comptes rendus.
5. **Droit d'accès (RGPD)** : l'export des données d'un contact inclut le compte rendu de chacune de ses visites.

## Droits (migration 0018, appliqués par la base)
- **Lecture** : l'auteur, l'organisateur de la visite, le **responsable du bien** (c'est lui qui rend compte au vendeur), le gérant et les managers. Jamais l'autre agence.
- **Écriture** :
  - uniquement sur une visite que l'on voit (règles de l'agenda), de type « visite », pour le bien de cette visite ;
  - jamais en lecture seule ;
  - un seul compte rendu par visite.
- **Modification** :
  - par l'auteur, le gérant ou les managers ;
  - seul le contenu change, jamais la visite, le bien ni l'auteur (droits par colonne).
- **Journal d'audit** : « Compte rendu de visite enregistré », avec l'identifiant de la visite seulement, sans donnée personnelle.

## Tests
- 3 tests unitaires : le texte pour le vendeur (champs vides omis, sans identité), et la synthèse des visites.
- 3 tests d'intégration :
  - qui voit le compte rendu ;
  - qui peut l'écrire (visite invisible, au nom d'un autre, lecture seule, bien différent, estimation : tout est refusé) ;
  - ce qui se modifie.
- 1 scénario de bout en bout : visite passée, rédaction, texte sans le nom des visiteurs, mise à jour, synthèse sur la fiche du bien, export RGPD, journal.

## Limites
- Le texte est un modèle fixe. Une version rédigée par IA pourra s'y ajouter quand l'IA sera ouverte (D-047). Elle sera comptée dans le quota « annonces et textes IA », et le modèle fixe restera disponible.
- Les champs libres sont sous la responsabilité du négociateur : le logiciel ne détecte pas un nom qui y serait écrit.
