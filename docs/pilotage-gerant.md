# Tableau de bord du gérant : « Pilotage » (critère F13)

Date : 2026-11-20 · Réservé au gérant et aux managers (menu et page). La base refuse aussi la lecture du journal d'audit aux autres rôles.

## Contenu
| Bloc | Ce qui est mesuré | Période |
|---|---|---|
| **Activité de l'équipe** | Pour chaque membre : contacts créés, consentements enregistrés, biens ajoutés, dossiers de biens, tâches créées (journal d'audit) ; tâches terminées (date de fin) ; tâches en retard | 7, 30 ou 90 jours (dates affichées) ; retard : aujourd'hui |
| **Portefeuille de biens** | Nombre de biens par statut, et mandats exclusifs actifs | État du jour |
| **Biens sans acquéreur correspondant** | Biens proposés dont aucun profil de recherche actif n'atteint 50 % (pondérations par défaut). Le meilleur score est affiché, ou « aucun profil compatible » | État du jour |
| **Relances en retard** | Tâches à faire dont l'échéance est dépassée (20 premières, les plus anciennes d'abord), avec la personne concernée | État du jour |

## Règles (D-036)
- **Aucun classement des personnes** : les membres sont listés par ordre alphabétique. Il n'y a ni score, ni « meilleur négociateur », ni tri par performance.
- **Chiffres mesurés seulement** : rien n'est extrapolé. Les rendez-vous et les affaires conclues n'apparaissent pas, car ils ne sont pas encore enregistrés dans l'application.
- L'activité vient du **journal d'audit**, qui ne fait qu'ajouter des lignes : un contact supprimé après sa création reste compté dans l'activité de la période.
- Un ancien membre garde ses chiffres, sous le nom « Ancien membre ».

## Tests
- 4 tests du calcul « biens sans acquéreur » : bien couvert à 100 %, aucun profil compatible, meilleur score sous le seuil (40 %), aucun profil actif.
- Bout en bout :
  - un négociateur ne voit ni le menu ni le contenu ;
  - le gérant voit les chiffres exacts de chaque membre, le bien couvert et la relance en retard qu'il vient de créer.

## Capture
[Pilotage](captures/13-pilotage.png)
