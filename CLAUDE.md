# Instructions pour Claude — ImmoPilot AI

## Communication avec le fondateur
- Le fondateur n'est pas développeur. Écrire en français, simplement, sans jargon inutile.
- **Toute question ou décision à lui soumettre passe par l'outil de questions à choix (AskUserQuestion)**, jamais par une question ouverte dans le texte :
  - des options claires à cocher (oui / non, option A / B / C…), la recommandation en premier avec « (Recommandé) » ;
  - une courte explication des conséquences de chaque option ;
  - la case « Autre » (ajoutée automatiquement) reste disponible pour une réponse libre ;
  - plusieurs questions indépendantes peuvent être regroupées (4 au maximum par envoi) ;
  - chaque question doit se comprendre seule, sans relire la conversation.
- Les décisions techniques réversibles se prennent sans demander ; elles sont documentées dans `docs/DECISIONS.md`.
- **Autorisation permanente du fondateur (2026-11-20) : « j'autorise à chaque fois, ne demande pas tout le temps ».** Sans redemander, une fois les tests et la CI au vert :
  - fusionner dans `main` ;
  - appliquer en préproduction (Supabase) les migrations testées ;
  - enchaîner sur l'étape suivante de la feuille de route déjà validée.
  Le fondateur est ensuite informé de ce qui a été fait, en une phrase.
- Demander encore l'accord seulement pour ce qui engage de l'argent, crée un nouveau compte externe ou touche des données personnelles réelles.

## Suivi du projet
- Tenir à jour `PROGRESS.md` (état des phases, blocages, journal) et `docs/DECISIONS.md`.
- Ne jamais marquer une fonctionnalité comme terminée sans tests.
- Ne jamais présenter de données fictives comme réelles, ni affirmer qu'une API fonctionne sans l'avoir testée (`scripts/check-data-sources.sh`).
