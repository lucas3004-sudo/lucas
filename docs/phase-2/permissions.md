# Phase 2 — Permissions

- **Date** : 20 novembre 2026
- **Principe** : les permissions sont appliquées **deux fois** :
  1. dans l'application, pour donner des messages clairs ;
  2. dans la base (RLS), pour qu'un oubli de code ne suffise pas à ouvrir un accès.

## 1. Rôles dans une agence

| Rôle | Pour qui | Résumé |
|---|---|---|
| **Gérant** | Titulaire de la carte T, dirigeant | Tous les droits sur l'agence, la facturation et les rôles. Double authentification obligatoire |
| **Manager** | Responsable d'équipe | Comme le gérant, sauf la facturation, la suppression de l'agence et la gestion des gérants |
| **Négociateur** | Salarié ou agent commercial | Ses contacts et biens, ce qui est partagé avec l'agence, le Copilot |
| **Assistant(e)** | Secrétariat, administratif | Saisie et mise à jour pour l'équipe, documents, rendez-vous. Ne supprime pas, n'exporte pas en masse |
| **Lecture seule** | Comptable, stagiaire, associé | Consultation de ce qui est partagé avec l'agence |
| *Système* | Tâches planifiées (alertes, relances calculées) | Lecture et propositions (L0 à L1), **jamais d'action externe** |

**Rôles de la plateforme** (hors agences) :
- **Opérateur** (ImmoPilot) : facturation, métriques agrégées, configuration globale. **Aucun accès aux données d'une agence** sans autorisation de support (architecture.md, section 7).

## 2. Visibilité

- Chaque contact et chaque bien a un **responsable** (`owner_user_id`) et une **visibilité** : `private` (le responsable, le gérant et les managers) ou `agency` (toute l'agence). La valeur par défaut est paramétrable par l'agence.
- **Matching à l'échelle de l'agence** : un négociateur voit qu'un acheteur **privé** d'un collègue correspond à son bien, sans voir l'identité de cet acheteur. Il voit seulement « un acquéreur de [prénom du collègue] correspond à 87 % » et un bouton pour **prévenir le collègue**. Ainsi, aucune donnée privée ne circule et l'agence ne perd aucune affaire.
- **Départ d'un collaborateur** : le gérant réaffecte son portefeuille en une action, journalisée.

## 3. Matrice rôles × actions

Légende :
- ✅ autorisé
- 🔸 seulement ses propres éléments (dont il est responsable), ou ceux partagés avec l'agence pour la lecture
- ❌ interdit

| Ressource / action | Gérant | Manager | Négociateur | Assistant | Lecture |
|---|---|---|---|---|---|
| Paramètres de l'agence | ✅ | lire | ❌ | ❌ | ❌ |
| Facturation, formule | ✅ | ❌ | ❌ | ❌ | ❌ |
| Inviter, changer un rôle | ✅ | ✅ (sauf gérant) | ❌ | ❌ | ❌ |
| Contacts : lire | ✅ | ✅ | 🔸 | ✅ partagés | ✅ partagés |
| Contacts : créer, modifier | ✅ | ✅ | 🔸 | ✅ (pour un collègue) | ❌ |
| Contacts : supprimer | ✅ | ✅ | ❌ (demande au gérant) | ❌ | ❌ |
| Biens : lire | ✅ | ✅ | 🔸 | ✅ partagés | ✅ partagés |
| Biens : créer, modifier | ✅ | ✅ | 🔸 | ✅ | ❌ |
| Dossier de bien, estimation | ✅ | ✅ | ✅ | ✅ | lire |
| Investment Studio | ✅ | ✅ | ✅ | ✅ | lire |
| Rédiger une annonce, un e-mail (brouillon) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Envoyer** un e-mail ou un SMS (L3) | ✅ | ✅ | 🔸 ses contacts | ❌ | ❌ |
| Export en masse (CSV) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Import CSV | ✅ | ✅ | ❌ | ✅ | ❌ |
| Tableau de bord du gérant | ✅ | ✅ | ❌ (voit sa propre activité) | ❌ | ❌ |
| Agent Center : voir | ✅ | ✅ | ses missions | ses missions | ❌ |
| Agent Center : activer ou désactiver un agent | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approbations L2 | ✅ | ✅ | 🔸 ses missions | ❌ | ❌ |
| Approbations L3 | ✅ | ✅ | 🔸 ses missions et ses contacts | ❌ | ❌ |
| Journal d'audit | ✅ | lire | ❌ | ❌ | ❌ |
| Effacement RGPD d'un contact | ✅ | ✅ | ❌ | ❌ | ❌ |
| Autoriser un accès support | ✅ | ❌ | ❌ | ❌ | ❌ |

## 4. Niveaux de risque des actions (agents et humains)

| Niveau | Définition | Exemples | Validation |
|---|---|---|---|
| **L0** | Lecture | Consulter DVF, lire un contact visible, rechercher | Automatique |
| **L1** | Écriture interne réversible | Brouillon d'annonce, note, tâche proposée, nouvelle analyse | Automatique, journalisée |
| **L2** | Modification interne importante | Fusionner des contacts, modification en masse, réaffectation, suppression logique | Approbation par un humain habilité (tableau ci-dessus) |
| **L3** | Externe, financier ou irréversible | Envoyer un e-mail ou un SMS, publier, payer, effacer définitivement, changer la sécurité | **Approbation humaine obligatoire, à chaque fois.** Aucun réglage ne permet de l'automatiser |

## 5. Règle des agents : jamais plus que l'humain

Un agent agit **pour le compte** d'un utilisateur. Ses droits effectifs sont donc l'**intersection** de trois ensembles :
1. les droits de l'utilisateur demandeur (rôle et visibilité, appliqués par la RLS, puisque la mission s'exécute avec son identité) ;
2. la liste d'outils autorisés dans la fiche de l'agent ;
3. le niveau maximal de la fiche (`max_permission`).

Exemple : le Listing Copywriter (maximum L1), lancé par un négociateur, peut lire les biens visibles par ce négociateur et créer un brouillon. Il ne peut ni publier (L3), ni lire un bien privé d'un collègue.

Les tâches planifiées s'exécutent avec le membre `systeme` de l'agence, limité à L0 et L1. Elles **proposent** (tâche, alerte) et ne font jamais d'action externe.

**Les fiches des agents sont versionnées dans le code (git).** Un agent ne peut donc pas modifier ses propres règles ou permissions : tout changement passe par une modification de code relue et validée (cahier des charges, partie 11).
