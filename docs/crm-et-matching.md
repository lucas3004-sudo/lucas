# CRM et matching (début de la phase 6, avancé à la demande du fondateur)

Date : 2026-11-20 · Choix du fondateur : « CRM et matching d'abord », avant les agents IA (phase 5).

## Ce qui est livré et testé

| Fonction | Contenu | Critère |
|---|---|---|
| **Contacts** | Création, modification, suppression (gérant, manager) ; rôles (acquéreur, vendeur, investisseur…), responsable, visibilité privé / agence ; recherche par nom, e-mail ou téléphone | F4 |
| **Doublons** | Signalés **avant** la création (même e-mail, même téléphone normalisé, même nom) avec un lien vers la fiche existante. Jamais de fusion automatique ; « créer quand même » sur confirmation explicite | F4 |
| **Consentements de prospection** | Par canal (téléphone, e-mail, SMS) : décision, date, expiration, **preuve obligatoire**. Ajout seul : un retrait est une nouvelle ligne, l'historique et les preuves restent | F4 |
| **Profils de recherche** | Type, budget, surface, pièces, communes (saisies par code postal, converties en codes INSEE via l'API Géo), équipements d'une **liste fermée** ; statut actif, en pause, clos | F4, F6 |
| **Biens de l'agence** | Adresse vérifiée par la BAN, caractéristiques déclarées, prix, DPE déclaré, statut (prospect, mandat, sous offre, vendu, retiré), type de mandat, visibilité ; lien « Créer un dossier de bien » pré-rempli | F5 |
| **Matching à l'échelle de l'agence** | Chaque bien proposé est comparé à **tous** les profils actifs de l'agence. Score 0–100, **pondérations modifiables**, explication critère par critère (rempli, partiel, non rempli, à vérifier). Un acquéreur privé d'un collègue apparaît comme « Acquéreur de [collègue] (privé) » | F6 |
| **Prévenir le collègue** | Crée une tâche pour le responsable de l'acquéreur, sans révéler son identité à l'auteur. Un seul signalement ouvert par collègue et par bien | F6, D-015 |
| **Tâches** | Création, attribution à un membre de l'agence, échéance, retard signalé, faite / rouverte ; liées à un contact ou à un bien | F4 |
| **Journal d'audit** | Création, modification, suppression, consentement, profil, bien, tâche. **Identifiants seulement** : aucun nom, e-mail ou téléphone dans le journal (un effacement RGPD n'y laisse rien) | — |

## Ajouts du 2026-11-21

### Agenda et rendez-vous (F4)
- Types de rendez-vous : visite, estimation, signature, rendez-vous, autre. On saisit la date en **heure de Paris** ; elle est enregistrée en UTC. Les changements d'heure sont gérés : une heure qui n'existe pas est refusée, une heure répétée correspond à sa première occurrence.
- Un rendez-vous peut être lié à un contact et à un bien. Si aucun lieu n'est saisi, l'adresse du bien sert de lieu. On peut planifier depuis la fiche d'un contact (« Planifier ») ou d'un bien (« Planifier une visite »).
- Un rendez-vous est visible par son organisateur, son auteur, le gérant et les managers.
  - Un négociateur ne planifie que pour lui-même.
  - Le gérant, un manager ou un assistant peuvent planifier pour un membre de l'agence, jamais pour quelqu'un d'extérieur (migration 0009).
- **Export calendrier (.ics)** : on peut télécharger un rendez-vous seul ou tous ses rendez-vous, et les ajouter à Google Agenda, Outlook ou Apple Calendrier. Un rendez-vous annulé est exporté comme « annulé », pour que l'agenda le retire.
- Le pilotage compte les rendez-vous passés et non annulés de chaque membre sur la période.

### Export des données d'un contact (RGPD, droit d'accès)
- Bouton « Exporter ses données (RGPD) » sur la fiche. Il produit un fichier JSON lisible avec les coordonnées, les rôles, les notes, les consentements avec leurs preuves, les profils de recherche, les rendez-vous et les tâches liés.
- Réservé à qui peut modifier le contact : son responsable, le gérant, un manager ou un assistant. Un collègue qui ne voit pas le contact reçoit « introuvable ». Chaque export est journalisé, avec l'identifiant seulement.

## Qui voit et fait quoi (appliqué par la base, RLS, migrations 0007 et 0008)

| | Gérant | Manager | Assistant | Négociateur | Lecture seule |
|---|---|---|---|---|---|
| Voir un contact ou un bien **privé** | tous | tous | les siens | les siens | les siens |
| Voir un contact ou un bien **partagé** | oui | oui | oui | oui | oui |
| Créer | pour n'importe quel membre | pour n'importe quel membre | pour n'importe quel membre | pour lui-même | non |
| Modifier, consentements, profils | tous | tous | tous | les siens | non |
| Supprimer | oui | oui | non | non | non |
| Critères des profils (matching) | tous | tous | tous | tous | tous |
| Identité d'un acquéreur privé d'un collègue | oui | oui | non | non | non |
| Tâches visibles | toutes | toutes | les siennes (reçues ou confiées) | idem | idem |

Changer le responsable d'un contact transfère aussi ses profils de recherche, dans la même transaction.

## Tests

- **Isolation (PostgreSQL, 24 tests)** dont 9 sur le CRM : contact privé invisible pour un collègue et l'autre agence ; pas de création au nom d'un collègue ; lecture seule sans création ; consentements non modifiables ; critères d'un profil privé lisibles **sans** l'identité ; tâches jamais attribuées hors agence ; **réattribution** (le nouveau responsable prend la main, l'ancien la perd).
- **Domaine** : matching (types, tolérances budget +10 % et surface −15 %, critères inconnus exclus du calcul, pondérations) et doublons (e-mail, téléphone +33, nom sans accents).
- **Bout en bout (Playwright, 7 scénarios)** : deux négociateurs, un acquéreur privé, un consentement, un profil à Amiens, un doublon signalé sans perte de saisie, un bien à 100 % de correspondance affiché anonymement, pondérations modifiées, collègue prévenu, tâche reçue et close, journal sans données personnelles.

### Défaut trouvé et corrigé par les tests
Le test de réattribution a montré qu'une règle de la base était **toujours vraie** : « un profil appartient au même responsable que son contact ». Dans une sous-requête SQL, `owner_user_id` sans préfixe désignait la colonne du contact, pas celle du profil. La migration 0008 qualifie les colonnes ; le test vérifie désormais le refus **et** le cas autorisé.

## Captures
- [Bien et acquéreurs correspondants](captures/09-bien-acquereurs-correspondants.png)
- [Tâches](captures/10-taches.png)
- [Fiche contact](captures/11-fiche-contact.png)

## Reste à faire pour couvrir entièrement F4 et F5
- Import CSV des contacts et des biens ; photos des biens.
- Pipeline des affaires (suivi des offres et des ventes).
- Tableau de bord du gérant (F13), à partir des tâches et des biens désormais disponibles.
- Investment Studio (simulations).

## Déploiement
Les migrations 0007 et 0008 sont **appliquées en préproduction** (Supabase, 2026-11-20). Contrôle : les 34 règles de sécurité du schéma `app` ont la même empreinte en préproduction et dans la base testée localement.
