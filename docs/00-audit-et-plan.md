# AI Agency OS — Audit initial et plan d'exécution

Date : 2026-11-20 · Branche : `claude/ai-agency-os-build-t1od41`

## 1. Audit du projet existant

| Élément | Constat |
|---|---|
| Contenu du dépôt | Un seul fichier : `vercel.json` (`{"outputDirectory": "public"}`) |
| Historique git | 3 commits (27/03/2026) : ajout puis suppression de `calcwidget-vercel.zip` (projet « calculs-saas » : widget calculatrice HTML statique), ajout de `vercel.json` |
| Lien avec l'AI Agency OS | Aucun. `vercel.json` est un résidu du projet calculatrice ; Vercel (serverless) ne convient pas à des workers persistants |
| Code, dépendances, tests | Aucun |
| Skills projet (`.claude/skills`) | Aucun. Seuls les Skills Anthropic synchronisés au niveau du compte (docx, pdf, xlsx, pptx, skill-creator, deep-research…) sont présents |
| `CLAUDE.md`, `.claude/settings.json`, sous-agents | Absents |

**Conclusion : le projet part de zéro.** Rien à préserver hormis `vercel.json`, que je propose de retirer (justification ci-dessus) lors de la phase 4.

### Environnement d'exécution constaté
- Session Claude Code **dans un conteneur cloud** (pas sur ton ordinateur) : seul ce qui est commité et poussé sur git est conservé.
- Disponible : Python 3.13, Node 22, SQLite 3.53, PostgreSQL client, Redis, Docker, ffmpeg 6.1, Claude Code 2.1.329.
- Réseau restreint : registres de paquets et GitHub OK ; **`api.elevenlabs.io`, `alexya.ai`, Meta Graph, TikTok API bloqués**. Les tests d'intégration réels nécessiteront d'autoriser ces hôtes (demande d'approbation explicite) et tes clés via formulaire sécurisé (jamais dans le chat ni dans git).

### Vérifications externes préliminaires
- **Dépôts de Skills** : les 9 dépôts cités existent et sont publics (vérifié par `git ls-remote`). Examen détaillé du contenu = phase 2.
- **Alexya** (alexya.ai) : générateur d'influenceurs IA (visage cohérent photo/vidéo), abonnement à crédits. Une source tierce mentionne une API REST et un connecteur MCP — **non vérifié** : le site est inaccessible depuis ce conteneur. Point d'attention : plusieurs tutoriels tiers l'associent à du contenu adulte ; l'intégration sera bridée en non‑explicite côté OS.
- **ElevenLabs** : API officielle documentée (`/v1/text-to-speech/{voice_id}`, `/v2/voices` avec recherche/pagination). Possibilités réelles de ton compte à vérifier avec ta clé.
- **Claude** : l'abonnement **Claude Pro ne fournit pas de clé API**. Un backend autonome 24/7 qui appelle Claude nécessite une clé API Anthropic facturée à l'usage (séparément). Tarifs API publics (cache du 2026-11-03, par million de tokens entrée/sortie) : Haiku 5.5 0,10 $/0,50 $ · Sonnet 5.5 2 $/10 $ · Opus 5.5 4 $/20 $. Batch API : −50 % sur les tâches non urgentes.

## 2. Architecture cible (résumé)

```
Dashboard (SPA sans build, servie par l'API)
        │ REST
API FastAPI ── DB (SQLite WAL → Postgres) ── Stockage fichiers (local → S3/R2)
        │
File de tâches en base (leasing, retries, dead-letter)
        │
Scheduler ──► Workers ──► Agents ──► LLM Gateway (offline | claude-code | api, budget plafonné)
                              └────► Intégrations (ElevenLabs, Alexya, ffmpeg, publication)
```

Choix réversibles (documentés dans `docs/DECISIONS.md`) : Python/FastAPI (écosystème média, SDK officiels), file d'attente en base plutôt que Redis (une brique de moins), frontend sans étape de build (moins de dépendances, moins de code à charger en contexte), Docker Compose pour migrer vers n'importe quel cloud.

### LLM Gateway — 3 modes
1. **offline** (défaut) : gabarits et règles déterministes, coût nul.
2. **claude-code** : les tâches créatives sont mises en file et exécutées dans une session Claude Code via les Skills du projet (consomme ton quota Pro, aucune facture API).
3. **api** : clé Anthropic, routage Haiku/Sonnet/Opus, prompt caching, Batch API, **plafond budgétaire journalier/mensuel bloquant**. Désactivé tant que tu ne l'autorises pas.

### Agents (37 rôles demandés → 10 agents)
| Agent | Rôles regroupés | Modèle par défaut (mode api) |
|---|---|---|
| Orchestrator | CEO, Project Manager | Sonnet |
| Reviewer (gate) | Devil's Advocate, Compliance, Quality Control | règles + Haiku |
| Research | Market, Competitor, Trend Research | Sonnet |
| Growth | Growth Director, Virality Analyst, Experimentation | Sonnet |
| Platform | TikTok, Instagram, Hashtag & SEO | Haiku |
| Planner | Social Media Manager, Content Calendar | règles + Haiku |
| Creative | Content Director, Concept Creator, Scriptwriter | Sonnet |
| Prompt Engineer | Prompt Engineer (image/vidéo/voix, cohérence personnage) | Haiku |
| Producer | Image, Video, Voice, Editing, Caption | outils (Alexya, ElevenLabs, ffmpeg) + Haiku |
| Community | Community Mgr, Conversation, Sentiment, Support, Conv. Quality | Haiku (batch) |
| Analyst | Analytics, Finance, Token Optimization, Daily Reporting | code + Haiku |

Chaque agent : mission, instructions (Skill chargé à la demande), outils autorisés, limites (tokens/appels/€), critères de succès, sorties typées transmises via la file de tâches.

## 3. Plan d'exécution priorisé

| # | Phase | Livrables | Critère de validation |
|---|---|---|---|
| 1 | Audit | Ce document | ✅ |
| 2 | Skills | Revue des 9 dépôts + autres (sous-agent, rapport court), grille sécurité/utilité/doublons, installation sélective dans `.claude/skills/` avec provenance (commit, licence) | Chaque Skill installé a une fiche dans `docs/SKILLS.md` |
| 3 | Optimisation Claude Code | `CLAUDE.md` compact, mémoire projet (`docs/`), `RESUME.md`, `DEVLOG.md`, `.claude/settings.json` (permissions, exclusions de lecture), sous-agents de dev avec modèle économique | Une nouvelle session reprend le travail en lisant < 150 lignes |
| 4 | Architecture | Squelette Python, config, secrets `.env` (gitignoré), Docker Compose | `make test` passe |
| 5 | Backend & DB | Schéma (contenus, tâches, agents, runs, usage, conversations, journaux), file de tâches, scheduler, workers, reprise sur erreur | Tests : retry, lease expiré, dead-letter |
| 6 | Multi-agents | 10 agents, LLM Gateway 3 modes, suivi tokens (mesuré / estimé / prévision), Character Studio | Run complet en mode offline de bout en bout |
| 7 | Intégrations | ElevenLabs (voix, réglages, génération, stockage), Alexya (si API confirmée, sinon alternative autorisée), ffmpeg montage, étude publication/stats/notifications | Test réel avec ta clé, ou limite documentée |
| 8 | Pipeline | RECHERCHE → … → ANALYSE, ID unique, statuts, historique, zone Drop | Un contenu traverse toutes les étapes, approbation humaine obligatoire avant publication |
| 9 | Dashboard | 14 pages, bouton « LANCER L'AGENCE », pause/arrêt/relance | Parcours testé au navigateur (Playwright) |
| 10 | Tests, sécurité, déploiement | Tests, revue sécurité, guide de déploiement cloud, rapport `/briefs/YYYY-MM-DD.md` | Checklist sécurité verte |

## 4. Périmètre (précisé le 2026-11-20)
Contexte business : agence de créatrice virtuelle IA ; l'utilisateur gère lui-même, hors de l'OS, la partie explicite et sa monétisation.
- **Dans l'OS** : tout le non explicite — personnage, contenus TikTok/Instagram, prompts SFW, voix, montage, QC, calendrier, croissance, statistiques, finances (chiffres saisis), rapports.
- **Hors OS, jamais pris en charge** : prompts ou contenus explicites, conversations automatisées ou vente sur plateformes adultes, contournement des règles des plateformes.
- Personnage : visage original (aucune ressemblance avec une personne réelle), clairement adulte, présenté comme IA.
- Architecture pensée pour devenir un SaaS plus tard (multi-comptes possible), sans complexité ajoutée maintenant.

## 5. Garde-fous non négociables (codés, pas seulement documentés)
- Aucune dépense : `ALLOW_PAID_CALLS=false` par défaut + plafond budgétaire vérifié avant chaque appel payant.
- Aucune publication externe sans approbation humaine (statut `approved` posé uniquement par l'utilisateur).
- Contenu explicite/adulte : désactivé en dur (pas d'option dans l'interface).
- Personnage IA présenté comme IA (mention obligatoire vérifiée par le Reviewer) ; aucun agent ne se fait passer pour une personne réelle en conversation.
- Pas de scraping contraire aux CGU : API officielles, imports manuels/CSV, recherche web publique.
- Chaque chiffre porte sa provenance : `measured`, `estimated`, `forecast`, `manual`.
- Clés API : `.env` local ou secrets de l'hébergeur, jamais renvoyées au frontend ni commitées.
