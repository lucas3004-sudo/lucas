# Accessibilité — audit automatique (phase 9)

Objectif : le niveau **WCAG 2.1 AA**, la référence du RGAA (le référentiel français). Il n'est pas encore exigé d'une petite entreprise, mais il est attendu par les grands comptes et les réseaux d'agences.

## Ce qui est vérifié à chaque modification (CI), dans `apps/web/e2e/accessibilite.spec.ts`
- **27 pages analysées par axe-core** (règles WCAG 2.1 A et AA), en **thème clair et en thème sombre** :
  - la connexion, l'inscription et la création d'agence ;
  - toutes les pages de l'application ;
  - une fiche contact, une fiche bien, son annonce et un dossier de bien.

  Le test échoue à la première violation « grave » ou « critique ».
- **Mobile (390 px de large)** :
  - cinq pages et le menu ouvert ;
  - aucune violation grave, et aucun défilement horizontal de la page.
- **Clavier** :
  - un lien « Aller au contenu » est le premier élément atteint ;
  - le contour de focus est visible ;
  - Entrée amène au contenu ;
  - le menu se parcourt et s'ouvre au clavier.
- **Contrôle positif** : une violation injectée volontairement (un bouton sans nom, une image sans texte de remplacement) est bien détectée. Sans ce contrôle, un audit qui ne tournerait pas passerait quand même.

## Corrigé grâce à l'audit (2026-11-21)
- **Contraste insuffisant** du texte discret (`ink-subtle`) :
  - thème clair : 3,2:1, alors que 4,5:1 est requis. Nouvelle teinte `#626b7e`, qui donne au moins 4,6:1 sur tous les fonds ;
  - thème sombre : 4,2:1 sur les fonds secondaires. Nouvelle teinte `#8390a6`, qui donne au moins 4,6:1.
- **Tableaux défilants inaccessibles au clavier** sur mobile (formules, journal, missions, pilotage, comparables, sensibilité, aperçu d'import). Ils sont maintenant atteignables par Tab et nommés pour les lecteurs d'écran.
- **Lien d'évitement** ajouté (WCAG 2.4.1) : on n'a plus à traverser tout le menu à chaque page.

## Limites
- axe-core détecte environ un tiers à la moitié des problèmes. Restent à vérifier à la main :
  - l'ordre de lecture avec un lecteur d'écran (NVDA, VoiceOver) ;
  - la pertinence des textes de remplacement ;
  - le zoom à 200 % ;
  - les messages d'erreur annoncés.
- Une déclaration d'accessibilité RGAA formelle demandera un audit manuel complet.
