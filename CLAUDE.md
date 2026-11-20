# AI Agency OS — instructions Claude Code

Agence de contenu multi-agents pour une créatrice virtuelle IA (TikTok/Instagram), **non explicite uniquement**.
Backend Python/FastAPI + SQLite, dashboard web sans build. Langue de travail : français.

## Reprise de session (lire d'abord, rien d'autre)
1. `docs/RESUME.md` : état, problèmes connus, prochaines étapes (≤ 80 lignes).
2. Ne lire ensuite que les fichiers utiles à la tâche (Grep d'abord, puis lecture ciblée avec offset/limit).

## Carte du code (ne pas tout lire)
- `agency/agents/handlers.py` : ce que fait chaque agent (pipeline complet) · `specs.py` : 11 agents (37 rôles)
- `agency/llm/gateway.py` : modes `offline|claude_code|api`, règles communes (CORE_RULES) · `anthropic_api.py` : routage, cache, budget
- `agency/queue.py`, `scheduler.py`, `worker.py`, `control.py` : file, planification, workers, cycle de vie
- `agency/api/routes.py` : API REST · `web/pages/<page>.js` : une page = un fichier
- `agency/growth.py` : moteur de croissance (indice de perf, bandit, A/B bayésien, créneaux, alertes, objectifs)
- `agency/agents/compliance.py` : garde-fous déterministes · `agency/migrations/*.sql` : schéma
- Docs : `docs/ARCHITECTURE.md`, `DECISIONS.md`, `INTEGRATIONS.md`, `SKILLS.md`, `TOKEN_OPTIMIZATION.md`, `DEPLOYMENT.md`, `DEVLOG.md`

## Commandes
- Tests : `.venv/bin/python -m pytest -q` (≈ 10 s, sans réseau, sans coût)
- Lancer : `.venv/bin/python -m agency serve` → http://127.0.0.1:8000
- CLI compacte : `python -m agency status|launch|work --once|cc list|cc show ID|cc submit ID -|character|brief|usage-import`

## Règles non négociables
- Jamais de contenu explicite/adulte, ni de fonctionnalité de vente adulte ou de chat sur plateforme adulte.
- Le personnage est une IA présentée comme telle ; adulte ; aucune ressemblance avec une personne réelle.
- Aucune dépense (API payante, crédits) ni publication externe sans accord explicite de l'utilisateur.
- Aucun chiffre inventé : toute donnée porte une provenance (`measured|manual|estimated|template|hypothesis|observed`).
- Ne jamais lire ni afficher `.env`, `data/`, `storage/` (secrets, base, médias lourds).
- Ne pas présenter une intégration comme fonctionnelle sans test réel réussi.

## Économie de tokens (Claude Pro)
- Réponses courtes ; citer `fichier:ligne` au lieu de recopier du code.
- Recherches larges → sous-agent `scout` (Haiku) qui rend ≤ 15 lignes ; revue de diff → sous-agent `reviewer` (Sonnet).
- `/compact` entre deux phases d'une même tâche (après avoir mis à jour `docs/RESUME.md`) ; `/clear` entre tâches sans rapport.
- Skills chargés à la demande ; ne pas lire `references/` d'un skill sans besoin.
- Fin de tâche : mettre à jour `docs/RESUME.md` (état + prochaines étapes) et ajouter 3-5 lignes dans `docs/DEVLOG.md`.
