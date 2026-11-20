# Architecture

```
Dashboard web (web/, ES modules, sans build) ──REST──► API FastAPI (agency/api)
                                                         │
                     ┌───────────────────────────────────┼──────────────────────────┐
                     ▼                                   ▼                          ▼
             SQLite WAL (data/agency.db)        Stockage fichiers           Journaux / notifications
             migrations SQL portables           (data/storage, → S3/R2)     (activity_log, webhook)
                     ▲
     Scheduler (every/daily) ──► File de tâches en base (lease, backoff, dead-letter, reprise après crash)
                                          │
                                   Workers ──► Handlers d'agents ──► LLM Gateway (offline | claude_code | api)
                                                                └──► Intégrations (ElevenLabs, ffmpeg, Alexya manuel)
```

## Processus
- `python -m agency serve` : API + worker + scheduler dans un seul processus (usage local).
- `api`, `worker`, `scheduler` séparés pour Docker/cloud (plusieurs workers possibles : le leasing est atomique).
- L'état de l'agence (`running|paused|stopped`) bloque les workers ; les actions humaines (approuver, régénérer, continuer) s'exécutent immédiatement.

## Pipeline (un contenu = un ID `CNT-…`, statut, étape, historique)
RECHERCHE `research.scan` → STRATÉGIE `growth.strategy` → contestation `reviewer.challenge` (crée les contenus) → CONCEPT+SCRIPT `creative.develop`
→ plateforme `platform.optimize` → PROMPT `prompt.build` → GÉNÉRATION `producer.generate` (voix ElevenLabs si activée ; visuels : manuel via Drop / placeholder)
→ MONTAGE `producer.edit` (ffmpeg, mention IA incrustée) → CONTRÔLE QUALITÉ `reviewer.qc` → **APPROBATION humaine** → `planner.schedule`
→ au créneau `publisher.prepare` (paquet d'export, publication manuelle) → **publié par l'humain** → ANALYSE `analyst.analyze` / `analyst.learn` (boucle d'amélioration).

Statuts : `in_progress, waiting_assets, needs_revision, awaiting_approval, approved, scheduled, ready_to_publish, published, rejected`.

## Agents (37 rôles → 11 agents, `agency/agents/specs.py`)
| Agent | Rôles | LLM |
|---|---|---|
| Orchestrator | CEO, Project Manager | aucun (règles) |
| Research | Market, Competitor, Trend Research | standard |
| Growth | Growth Director, Virality Analyst, Experimentation | standard |
| Reviewer | Devil's Advocate, Compliance, Quality Control | simple + règles déterministes prioritaires |
| Creative | Content Director, Concept Creator, Scriptwriter | standard |
| Platform | TikTok, Instagram Strategist, Hashtag & SEO | simple |
| Prompt Engineer | Prompt Engineer | simple |
| Producer | Image, Video, Voice, Editing, Caption | aucun (outils) |
| Planner | Social Media Manager, Content Calendar | aucun |
| Community | Community Mgr, Conversation, Sentiment, Support, Conversation Quality | simple (lot de 20) |
| Analyst | Analytics, Finance, Token Optimization, Daily Reporting | aucun |

Chaque spec : mission, instructions (courtes, centralisées), outils, limites, critères de réussite, transmission (`handoff`), skills à charger en mode claude_code.

## LLM Gateway
- `offline` (défaut) : modèles déterministes (`agents/library.py`), coût nul, sorties marquées `offline-template`.
- `claude_code` : tâche JSON (instructions + entrée + schéma) dans `data/claude_code/inbox` ; la session Claude Code répond via le skill `agency-run-tasks` ; le job reprend.
- `api` : SDK Anthropic, palier → modèle (`simple` Haiku 5.5, `standard` Sonnet 5.5, `complex` Opus 5.5), effort par palier, sorties JSON structurées, préfixe système partagé mis en cache, repli serveur en cas de refus (Sonnet/Opus), **plafonds jour/mois vérifiés avant chaque appel**, repli hors ligne.

## Données & provenance
Tables principales : `contents`, `content_history`, `assets`, `jobs`, `runs`, `schedules`, `characters`, `research_items`, `competitors`, `experiments`, `metrics`, `messages`, `finance_entries`, `llm_calls`, `cc_usage`, `api_usage`, `activity_log`, `notifications`, `integration_checks`.
Provenance : `measured` (API/journaux), `manual` (saisi), `estimated` (calculé), `template`, `hypothesis`, `observed` (avec URL).

## Sécurité
Secrets uniquement en variables d'environnement ; jamais renvoyés par l'API. Jeton `AGENCY_ADMIN_TOKEN` (comparaison à temps constant) obligatoire si exposé en ligne.
Garde-fous codés en dur (`config.py`) : contenu adulte désactivé, approbation humaine, mention IA. Uploads : liste blanche d'extensions, taille max, attestation « non explicite », chemins confinés au stockage.

## Migration cloud
Docker Compose (api + worker + scheduler, volume `data/`). Passage à Postgres : SQL volontairement portable (TEXT ISO, pas de fonctions SQLite hors `substr`). Stockage : réimplémenter `agency/storage.py` pour S3/R2.
