# Décisions techniques (ADR courts)

| # | Date | Décision | Pourquoi | Réversible |
|---|---|---|---|---|
| 1 | 2026-11-20 | Python 3.11+ / FastAPI / SQLite WAL | Écosystème média (ffmpeg), SDK officiels, zéro serveur à gérer | Oui (Postgres prévu) |
| 2 | 2026-11-20 | File de tâches en base, pas de Redis | Une brique d'infra en moins ; leasing atomique suffisant à cette échelle | Oui |
| 3 | 2026-11-20 | Dashboard sans build (ES modules, 1 fichier par page) | Pas de toolchain JS ; Claude ne lit que la page concernée | Oui |
| 4 | 2026-11-20 | 37 rôles → 11 agents | Rôles trop proches fusionnés : moins d'appels LLM, moins de prompts | Oui |
| 5 | 2026-11-20 | Mode LLM par défaut `offline` | Aucune dépense sans accord ; pipeline testable gratuitement | Réglage |
| 6 | 2026-11-20 | Mode `claude_code` via inbox/outbox | Utiliser le quota Pro de façon légitime (session interactive), sans clé API | — |
| 7 | 2026-11-20 | Règles déterministes avant LLM (QC, conformité, communauté sensible) | Gratuit, prévisible, impossible à « convaincre » | — |
| 8 | 2026-11-20 | Alexya en mode manuel (prompts → Drop) | API non vérifiable depuis l'environnement ; aucune intégration fictive | Oui, dès docs + clé |
| 9 | 2026-11-20 | Publication = paquet d'export manuel | APIs Meta/TikTok exigent apps validées ; validation humaine obligatoire de toute façon | Oui |
| 10 | 2026-11-20 | Garde-fous codés en dur (adulte off, approbation, mention IA) | Exigence utilisateur ; non modifiables par réglage ou variable | Non (volontaire) |
| 11 | 2026-11-20 | Rapport quotidien sans LLM | Zéro token ; chiffres issus de la base avec provenance | Oui |
| 12 | 2026-11-20 | Skills tiers vendorisés (Markdown seul, SOURCE.md) | Revue de sécurité possible, pas de dépendance réseau, pas de script exécuté | Oui |
| 13 | 2026-11-20 | `vercel.json` supprimé | Résidu d'un projet calculatrice ; serverless incompatible avec des workers persistants | Oui (historique git) |
