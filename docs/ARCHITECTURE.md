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

## Moteur de croissance (`agency/growth.py`, sans LLM)
- **Indice de performance** = vues / médiane de la plateforme (≥ 3 contenus mesurés) ; « gagnant » ≥ seuil (×2 par défaut).
- **Allocation par bandit (Thompson sampling)** sur piliers et formats : la donnée décide du mix, le LLM écrit angles et hooks.
- **Double-down** : chaque gagnant reçoit une suite au run suivant (une seule fois).
- **A/B bayésien** : une expérience à la fois (type de hook, durée), variantes alternées, P(B>A) par Monte-Carlo, conclusion à 95 % avec vues minimales, puis rotation.
- **Quotas** : chaque run est dimensionné par le déficit de contenus des comptes actifs sur 3 jours.
- **Séries** (un épisode par série active et par run), **déclinaisons** YouTube Shorts / Snapchat Spotlight validées avec le parent.
- **Veille** (horaire) : chute de portée, absence de publication 48 h, compte restreint, file de validation ; **revue hebdo** `briefs/weekly-AAAA-Sxx.md`.
- **Objectifs** par compte avec projection linéaire (provenance `forecast`) ; **partenariats** (CRM + brouillons de messages, envoi humain).

## Business (`agency/business.py`)
- Deal de marque (grand public) : `agreed` → livrables = contenus sponsorisés (brief sponsor) → « payé » crée le revenu (une fois).
- Mentions légales FR (loi n° 2023-451, à valider par un juriste) : « Image virtuelle » sur chaque contenu (légende + incrustation),
  « Collaboration commerciale avec <marque> » en tête de légende et en incrustation pour tout contenu sponsorisé ; catégories interdites/encadrées bloquées.
- Rentabilité : revenu par contenu (deal réparti sur ses livrables + écritures liées), coût LLM estimé, € / 1 000 vues, par plateforme et pilier.
- Kit média + grille tarifaire = vues moyennes réelles × **votre** CPM (aucun tarif marché inventé), export Markdown dans `briefs/`.

## Données & provenance
Tables principales : `accounts`, `account_events`, `series`, `collabs`, `targets`, `contents`, `content_history`, `assets`, `jobs`, `runs`, `schedules`, `characters`, `research_items`, `competitors`, `experiments`, `metrics`, `messages`, `finance_entries`, `llm_calls`, `cc_usage`, `api_usage`, `activity_log`, `notifications`, `integration_checks`.
Provenance : `measured` (API/journaux), `manual` (saisi), `estimated` (calculé), `template`, `hypothesis`, `observed` (avec URL).

## Sécurité
Secrets uniquement en variables d'environnement ; jamais renvoyés par l'API. Jeton `AGENCY_ADMIN_TOKEN` (comparaison à temps constant) obligatoire si exposé en ligne.
Garde-fous codés en dur (`config.py`) : contenu adulte désactivé, approbation humaine, mention IA. Uploads : liste blanche d'extensions, taille max, attestation « non explicite », chemins confinés au stockage.

## Migration cloud
Docker Compose (api + worker + scheduler, volume `data/`). Passage à Postgres : SQL volontairement portable (TEXT ISO, pas de fonctions SQLite hors `substr`). Stockage : réimplémenter `agency/storage.py` pour S3/R2.
