# Suivi des affaires, de l'offre à l'acte (critère F12, version légère)

Date : 2026-11-21.

## Ce que fait l'écran « Affaires »
- **Ouverture** depuis la fiche d'un bien (« Ouvrir une affaire ») ou depuis le menu. On saisit l'acquéreur, le vendeur, le prix convenu, les honoraires, la date d'acceptation de l'offre et le négociateur en charge.
- **Étapes** : offre acceptée, compromis signé, conditions levées, acte signé, ou affaire abandonnée.
- **Statut du bien synchronisé** : il passe « sous offre » pendant l'affaire et « vendu » à l'acte. À l'abandon, il redevient « sous mandat » s'il n'a pas d'autre affaire en cours. Le changement ne se fait que si l'utilisateur a le droit de modifier le bien.
- **Échéances calculées**, avec le nombre de jours restants :
  - **fin du délai de rétractation** : 10 jours à compter du lendemain de la notification, prolongés au premier jour ouvrable si le délai tombe un samedi, un dimanche ou l'un des 11 jours fériés nationaux (art. L271-1 du CCH, art. 642 du CPC) ;
  - date limite d'obtention du prêt ;
  - signature prévue de l'acte.
  Elles sont reprises sur la page « Affaires » (14 prochains jours et retards).
- **Pièces par étape** : une liste indicative à cocher (titre de propriété, diagnostics, ERP, pièces de copropriété, offre de prêt, purge du droit de préemption…).
- **Pilotage** : les actes signés de chaque négociateur sur la période.
- **Export RGPD** : les affaires où le contact est acquéreur ou vendeur sont incluses.

## Droits (migration 0010, RLS)
- Une affaire suit la **visibilité de son bien** : un bien privé, une affaire privée.
- Elle est modifiée par le négociateur en charge, le gérant, un manager ou un assistant. Elle est supprimée par le gérant ou un manager.
- Un négociateur n'ouvre une affaire que pour lui-même, et sur un bien qu'il voit. Le rôle lecture seule n'en ouvre pas.

## Précautions
- Les dates calculées sont **indicatives** : le notaire fait foi. La règle de calcul est rappelée sous l'échéance.
- Les jours fériés propres à l'Alsace-Moselle (Vendredi saint, 26 décembre) ne sont pas pris en compte. Ces départements sont déjà hors périmètre DVF.
- La liste des pièces est indicative : elle n'a aucune valeur juridique.

## Tests
- 8 tests du calendrier : dates de Pâques, jours fériés 2026, jours ouvrables, rétractation (cas courant, samedi, 11 novembre, Noël).
- 3 tests des échéances selon l'étape.
- 2 tests d'isolation :
  - une affaire sur un bien privé est invisible pour un collègue et pour l'autre agence, et ce collègue ne peut pas en ouvrir une sur ce bien ;
  - sur un bien partagé, un collègue lit l'affaire mais ne la modifie pas.
- Bout en bout : ouverture depuis le bien, compromis, délai de rétractation affiché, pièce cochée, bien « sous offre » puis « vendu ».

## Capture
[Affaire](captures/14-affaire.png)
