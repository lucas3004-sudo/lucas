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
- Demander l'accord pour tout ce qui engage de l'argent, des comptes externes ou des données sensibles.

## Suivi du projet
- Tenir à jour `PROGRESS.md` (état des phases, blocages, journal) et `docs/DECISIONS.md`.
- Ne jamais marquer une fonctionnalité comme terminée sans tests.
- Ne jamais présenter de données fictives comme réelles, ni affirmer qu'une API fonctionne sans l'avoir testée (`scripts/check-data-sources.sh`).
