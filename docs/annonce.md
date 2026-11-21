# Fiche annonce et contrôle des mentions obligatoires

Date : 2026-11-21. Première brique de la rédaction assistée (F9), **sans IA** : le texte est assemblé à partir des données du bien, sans aucune reformulation des caractéristiques.

## Ce que fait l'écran « Annonce » (fiche d'un bien)
- **Contrôle des mentions** (fiche juridique, section 1.1) :
  - prix ;
  - classes énergie **et** climat ;
  - fourchette des dépenses annuelles d'énergie et son année de référence ;
  - copropriété : statut, nombre de lots, charges annuelles moyennes, procédure en cours éventuelle ;
  - honoraires : qui les paie et, s'ils sont à la charge de l'acquéreur, leur pourcentage TTC ;
  - lien vers le barème de l'agence ;
  - renvoi vers Géorisques et mention « consommation énergétique excessive » pour les classes F et G, ajoutés automatiquement.
- **Copie bloquée** tant qu'une mention manque, conformément à la règle « blocage de la publication si elles manquent ».
- **Texte produit** :
  - titre ;
  - description de l'agent, reprise telle quelle ;
  - caractéristiques ;
  - prix avec les honoraires : prix hors honoraires = prix affiché / (1 + taux) ;
  - DPE et dépenses d'énergie ;
  - copropriété ;
  - Géorisques.
  Les espaces du texte sont ordinaires, pour qu'un collage dans un portail se passe bien.
- **Barème des honoraires** : un lien unique pour toute l'agence, réglé dans les paramètres par le gérant ou un manager.

## Précautions
- Le contrôle est une **aide**, pas une garantie de conformité : certaines bases légales sont encore « à confirmer » dans la fiche juridique. La mention est affichée à l'écran.
- L'agent reste responsable de la publication. ImmoPilot ne publie rien.
- Le texte ne contient aucune IA. La future rédaction par IA (avec une clé Anthropic) sera marquée « générée par IA » (AI Act, art. 50).

## Données (migration 0011)
- Nouvelles colonnes du bien : classe climat, dépenses d'énergie (basse, haute, année), copropriété (statut, lots, charges, procédure), honoraires (payeur, %), titre et description d'annonce.
- Les droits ne changent pas : ce sont ceux du bien (RLS de la migration 0007).
- Nouveau paramètre de l'agence : lien du barème (https uniquement).

## Tests
- 7 tests unitaires :
  - annonce complète ;
  - mentions manquantes listées une à une ;
  - copropriété ;
  - fourchette de dépenses incohérente ;
  - prix hors honoraires (250 000 € à 5 % donne 238 095 €) ;
  - texte avec mentions ;
  - classe G et honoraires vendeur.
- Bout en bout : le bien commence avec 5 mentions manquantes et la copie bloquée. Une fois les champs saisis, il n'en reste qu'une (le barème). Après le réglage du barème, l'annonce est complète et le texte vérifié.

## Capture
[Annonce](captures/15-annonce.png)
