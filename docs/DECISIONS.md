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
| 15 | 2026-11-20 | Pas de gestion MYM / Telegram / plateformes adultes, pas de multi-comptes, bots, faux engagement | Hors périmètre fixé par l'utilisateur au départ ; risques de bannissement et juridiques | Non (volontaire) |
| 16 | 2026-11-20 | Croissance pilotée par bandit + A/B bayésien + double-down, sans LLM | Décisions d'allocation reproductibles, gratuites et explicables ; le LLM se concentre sur la créativité | Oui |
| 17 | 2026-11-20 | Mentions « Image virtuelle » / « Collaboration commerciale » obligatoires et non désactivables ; catégories sponsorisées interdites bloquées | Loi influenceurs FR (2023-451) : amendes et risques pénaux ; protège le revenu | Non (volontaire) |
| 18 | 2026-11-20 | Grille tarifaire = vues réelles × CPM saisi par l'utilisateur | Pas de « tarif marché » inventé | Oui |
| 19 | 2026-11-20 | Refus : vente via Drop/Telegram, gestion de groupe ou de DM Telegram, chatting de vente avec les fans | Vente de contenu adulte + fans trompés sur l'interlocuteur ; exclu dès le cahier des charges ; exclu aussi de la version SaaS | Non |
| 20 | 2026-11-20 | To-do du matin (07:45) déterministe | Liste uniquement les actions humaines, triées par priorité | Oui |
| 21 | 2026-11-20 | Niche Lab : l'IA note avec preuves, le code calcule le score, l'humain applique | Choix de niche traçable ; pas de score sans données (hors ligne = pas de score) | Oui |
| 14 | 2026-11-20 | Personnage par défaut « Nour » (franco-marocaine, quartier, étudiante) à **22 ans** ; âge plancher **21** codé en dur ; pas de symboles religieux ni de clichés | Demande initiale 18-19 ans refusée : le personnage sert de vitrine à une activité adulte hors OS ; en France l'art. 227-23 du Code pénal vise aussi les images d'une personne « dont l'aspect physique est celui d'un mineur » — un personnage IA n'a pas d'âge prouvable, seule l'apparence compte | Non (volontaire) |
