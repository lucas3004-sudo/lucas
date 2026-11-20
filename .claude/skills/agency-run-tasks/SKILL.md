---
name: agency-run-tasks
description: Process the AI Agency OS agent tasks waiting for Claude Code (llm_mode=claude_code) - read each task, answer with schema-valid JSON, submit, advance the pipeline.
---
# Traiter les tâches de l'agence (mode claude_code)

Les agents écrivent des tâches courtes dans `data/claude_code/inbox/`. Tu les traites par lot avec le quota Claude Code, sans API payante.

## Procédure (économe en tokens)
1. `.venv/bin/python -m agency cc list` → liste compacte. Si vide : `.venv/bin/python -m agency work --once` puis relister ; si toujours vide, s'arrêter.
2. Une seule fois par session : `.venv/bin/python -m agency character` (bible compacte du personnage).
3. Pour chaque tâche : `.venv/bin/python -m agency cc show <task_id>` → lire `instructions`, `input`, `schema`.
4. Produire **uniquement** un JSON valide pour `schema` (toutes les clés requises, aucune clé en plus), puis :
   `.venv/bin/python -m agency cc submit <task_id> - <<'JSON'` … `JSON`
   En cas d'erreurs de validation, corriger et resoumettre.
5. Après le lot : `.venv/bin/python -m agency work --once` pour faire avancer le pipeline (de nouvelles tâches peuvent apparaître : reprendre en 1, maximum 3 tours par session).
6. Finir par un résumé de 3 lignes (tâches traitées, contenus en attente de validation humaine).

## Règles (identiques à l'API)
- Non explicite uniquement ; aucune promotion de plateforme adulte ; personnage adulte, présenté comme IA, jamais « humain ».
- Aucun chiffre, statistique, témoignage ou source inventé. Donnée inconnue = "unknown" ; hypothèse = confiance "low".
- Ne pas copier les concurrents : extraire des patterns.
- Tâche `research.scan` : WebSearch autorisé pour des tendances **publiques et récentes** ; mettre l'URL dans `source_url` (sinon `""`).
- Tâches `creative.develop` : skills utiles à charger si besoin : `tiktok-script`, `hook-anatomy`, `storytelling-and-narrative`.
- Tâches `community.triage` : skills `read-the-room`, `reply-and-comment-writer` ; escalader (escalate=true) tout sujet sensible.
- Rester bref : chaînes courtes, pas de prose hors JSON.
