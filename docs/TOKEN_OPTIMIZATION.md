# Optimisation des tokens et de Claude Pro

Objectif : utiliser plus efficacement le quota, **sans contourner aucune limite**.

## Côté développement (Claude Code)
- **Contexte** : `CLAUDE.md` court + `docs/RESUME.md` comme seule lecture de reprise ; Grep avant Read ; lectures ciblées ; `.claude/settings.json` interdit la lecture de `.env`, `data/`, `storage/`, médias.
- **Divulgation progressive** : les skills ne chargent que leur description (~600 tokens pour 13 skills) ; corps et `references/` à la demande. Le code est découpé (1 page web = 1 fichier, 1 agent = 1 fonction).
- **Compaction stratégique** : avant `/compact`, mettre à jour `docs/RESUME.md` (décisions, fichiers touchés, prochaines étapes) ; `/compact` entre phases, `/clear` entre tâches sans rapport.
- **Sous-agents** : `scout` (Haiku, lecture seule, ≤ 15 lignes) pour les recherches larges ; `reviewer` (Sonnet) pour relire un diff. Un seul agent par tâche, prompts autonomes et courts.
- **Suivi** : `/usage` (forfait) et `/cost` (session, indicatif). Dashboard › Token & Usage › « Importer les journaux locaux » lit `~/.claude/projects/*/*.jsonl` (tokens **mesurés**, dédupliqués par message).

## Côté agence (runtime)
- **Mode par défaut `offline`** : 0 token. `claude_code` : quota Pro via sessions interactives (`/agency-run-tasks`, un lot par session). `api` : payant, plafonné.
- **Routage** : `simple` → Haiku 5.5 (0,10 $/0,50 $ par M tokens), `standard` → Sonnet 5.5 (2 $/10 $), `complex` → Opus 5.5 (4 $/20 $) — tarifs publics du 2026-11-03, à revérifier.
- **Pas de LLM quand une règle suffit** : orchestrateur, producteur, planificateur, analyste et rapport quotidien sont déterministes ; QC et conformité passent d'abord par des règles.
- **Prompts** : règles communes centralisées (`CORE_RULES`) + bible compacte du personnage = préfixe stable mis en cache ; instructions d'agent de 1-3 phrases ; sorties JSON strictes et bornées (`max_tokens`, `maxItems`).
- **Regroupement** : concept + script + légende en un seul appel ; communauté par lots de 20.
- **Budgets** : `daily_budget_usd` / `monthly_budget_usd` vérifiés **avant** chaque appel (coût pire cas estimé) ; repli hors ligne.
- **Monitoring** : chaque appel → `llm_calls` (tokens mesurés, coût estimé, latence) ; page Token & Usage : agents et tâches les plus coûteux, suggestions automatiques.

## Limites honnêtes
- Les tokens du mode `claude_code` par tâche sont **estimés** (3,5 caractères/token) ; les sessions importées sont mesurées.
- « Équivalent API » d'une session Pro n'est pas une facture.
- Le changement de modèle dans Claude Code dépend de votre abonnement : vérifiez avec `/model`.
