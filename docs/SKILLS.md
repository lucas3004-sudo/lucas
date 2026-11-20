# Skills tiers installés (revue du 2026-11-20)

Source : 9 dépôts publics clonés en shallow dans le scratchpad (jamais exécutés). 12 skills installés dans `.claude/skills/`, chacun avec un `SOURCE.md` (dépôt, SHA, licence, verdict, fichiers omis). Tous en Markdown pur, aucun script, hook ni appel réseau.

## Skills évalués

| Dépôt | Skill | Thème | Verdict | Raison |
|---|---|---|---|---|
| social-media-skills/skills | tiktok-script | script TikTok | installé | Hook, rétention, doc de production complet |
| social-media-skills/skills | competitor-analysis | veille concurrents | installé | Données publiques seulement, pas de fausses métriques |
| social-media-skills/skills | reply-and-comment-writer | communauté, conversation | installé | Brouillons à valider, refuse l'automatisation |
| social-media-skills/skills | crisis-and-moderation | modération | installé | Triage de gravité, humain dans la boucle |
| social-media-skills/skills | storytelling-and-narrative | storytelling | installé | Cadre BEATS, sans témoignage inventé |
| social-media-skills/skills | analytics-and-reporting | analytics | installé | Métriques de signal, actions suivantes |
| social-media-skills/skills | hook-writer, reels-script, short-form-video-script | hooks, scripts | rejeté | Doublon de tiktok-script et hook-anatomy |
| social-media-skills/skills | tiktok-growth, instagram-growth, trend-jacking, viral-reverse-engineering | croissance, tendances | rejeté | Doublon partiel, 7 Ko chacun, coût de tokens |
| social-media-skills/skills | voice-builder, content-pillars, content-calendar | voix, piliers | rejeté | Couvert par les agency-* maison |
| social-media-skills/skills | capcut, kling, runway, luma, flux, suno, opus-clip, descript, synthesia | outils tiers | rejeté | Outils externes hors périmètre |
| social-media-skills/skills | social-selling-and-dm, ugc-and-influencer | DM, UGC | rejeté | Risque d'automatisation DM et de faux UGC |
| social-media-skills/skills | ~85 autres (LinkedIn, X, Pinterest, Facebook, Reddit, YouTube, email...) | autres plateformes | rejeté | Hors cible TikTok/Instagram |
| scrollmark/social-skills | hook-anatomy | hooks viraux | installé | Court, patterns et anti-patterns, refs TikTok/IG |
| scrollmark/social-skills | trend-radar | recherche de tendances | installé | Pertinence et timing de participation |
| scrollmark/social-skills | read-the-room | sentiment, commentaires | installé | Registres, emojis, sous-texte des commentaires |
| scrollmark/social-skills | platform-fluency | conventions TikTok/IG | installé | Algorithme et formats par plateforme |
| scrollmark/social-skills | content-autopsy, repurpose-engine, voice-matching | post-mortem, recyclage | rejeté | Chevauche analytics et skills maison |
| scrollmark/social-skills | video-production, editor-*, audio/media-acquisition, subject-compositing, studio-setup, edit-handoff, brand-kit | production vidéo | rejeté | Pipeline lié à des scripts Python et au repo (src/) |
| scrollmark/social-skills | video-formats, agent-interview | formats, intake | rejeté | Dépend du pipeline Scrollmark |
| rombtr/Sales-Skills | objection-handling | objections de vente | installé | Principes classiques, licence MIT (README seul) |
| rombtr/Sales-Skills | sentiment-analysis, storytelling, empathy, conversational-flow-management | conversation | rejeté | Orienté bots de vente, doublon de read-the-room |
| rombtr/Sales-Skills | spam-bot-detection-avoidance, scarcity-urgency-calibration, voicemail-drop, ~70 autres | prospection | rejeté | Contournement de filtres anti-spam, urgence manipulatrice |
| coreyhaines31/marketingskills | copywriting, social, competitors, competitor-profiling | copywriting, social | rejeté | Orienté SaaS/landing pages, 11-19 Ko |
| coreyhaines31/marketingskills | marketing-psychology, community-marketing, analytics, video | psychologie, communauté | rejeté | Orienté SaaS, lourds, doublons installés |
| coreyhaines31/marketingskills | sales-enablement | objections (B2B) | rejeté | 21 Ko B2B, objection-handling suffit |
| coreyhaines31/marketingskills | cold-email, sms, prospecting, ads, ~40 autres | acquisition payante, B2B | rejeté | Hors périmètre organique |
| kkoppenhaver/cc-skills | tweet, linkedin | copywriting | rejeté | Voix personnelle de l'auteur |
| kkoppenhaver/cc-skills | youtube-producer, video-subtitler, nano-banana, featured-image | vidéo, image | rejeté | Dépendances (Whisper, Gemini CLI, Chromium) |
| kkoppenhaver/cc-skills | kit-broadcast, fact-check, ai-fluency | divers | rejeté | Hors périmètre, pas de licence unique |
| kkoppenhaver/cc-skills | (dépôt entier) | tous | référence seule | Pas de LICENSE racine, licences par skill |
| sup3x/claude-code-eco | eco | optimisation tokens | installé | Mode frugal, règles d'outils et de cache |
| sup3x/claude-code-eco | eco-audit, eco-max, eco-report | audit tokens | rejeté | Lisent config et transcripts locaux, redondant |
| HermeticOrmus/token-optimization-skills | token-optimization | tokens | rejeté | 850 octets, doublon de eco |
| tontran/claude-code | strategic-compact | compaction contexte | rejeté | Requiert hooks et scripts Node absents |
| tontran/claude-code | video-editing, search-first, gateguard, autonomous-agent-harness | divers | rejeté | Hooks, agents autonomes, hors périmètre |
| tontran/claude-code | ~90 autres (Java, Swift, homelab...) | technique | rejeté | Hors périmètre |
| anthropics/skills | skill-creator, docx, pdf, xlsx, pptx | outils documents | rejeté | Déjà disponibles sur le compte |
| anthropics/skills | brand-guidelines, internal-comms, theme-factory, canvas-design | branding | rejeté | Spécifique Anthropic ou design générique |
| vyralcontent/content-skills (recherche web) | viral-hooks, viral-tiktok-content | hooks | référence seule | Non cloné ni audité |
| valorisa/Claude-Skills, outfitter-dev/agents (recherche web) | token-optimization, context-management | tokens, délégation | référence seule | Non clonés ni audités |

## Skills installés et chargement

Divulgation progressive : seuls `name` + `description` (environ 200 caractères) sont chargés à chaque session. Le corps de `SKILL.md` ne se charge que si la tâche correspond. Les fichiers `references/` ne se lisent qu'à la demande du corps.

| Skill | Se déclenche quand | Références (à la demande) |
|---|---|---|
| tiktok-script | Écriture d'un script TikTok | mécaniques, hooks et rétention, sons, exemples |
| hook-anatomy | Analyse ou génération de hooks | `references/platforms/{tiktok,instagram,...}.md` |
| trend-radar | Évaluation d'une tendance, timing | idem par plateforme |
| platform-fluency | Conventions et algorithme TikTok/IG | idem par plateforme |
| read-the-room | Interprétation de commentaires, DM, ton | `slang-and-signals.md`, plateformes |
| reply-and-comment-writer | Réponse aux commentaires et DM | commentaires, DM difficiles, exemples |
| crisis-and-moderation | Bad buzz, deepfake, modération | triage, playbook, escalade |
| storytelling-and-narrative | Structuration d'une histoire | BEATS, arcs et formats |
| competitor-analysis | Veille concurrentielle sociale | cadre Scout, recettes d'audit |
| analytics-and-reporting | Lecture des stats, rapports | cadre Meter, métriques par objectif |
| objection-handling | Réponse à une objection | aucune |
| eco | Mention de tokens/coût, ou `/eco` | aucune (`/eco setup` propose des réglages) |

Remarques : six skills (social-media-skills) citent des skills frères absents (brand-profile, voice-builder, WoopSocial) ; traiter ces renvois comme facultatifs. Aucun skill n'est modifié hors `description` raccourcie.

## Lacunes (non couvertes)

- Délégation aux sous-agents et gestion de contexte : seulement `eco`, pas de skill dédié.
- Bible de personnage, pipeline de contenu, conformité, brief quotidien : prévus en `agency-*` maison.
- Divulgation « IA transparente » et règles des plateformes sur le contenu généré : à écrire dans `agency-compliance`.
- Production et montage vidéo, branding visuel : aucun skill sûr et autonome trouvé.
- Légal growth (droit, ToS, droits musique) : à intégrer à `agency-compliance`.
- Copywriting généraliste : aucun skill léger adapté au social, à écrire en maison si besoin.

## Skills et sous-agents propres au projet
| Élément | Rôle | Chargement |
|---|---|---|
| `.claude/skills/agency-run-tasks` | Traiter les tâches des agents en mode `claude_code` (inbox → JSON validé → reprise du pipeline) | À la demande : `/agency-run-tasks` |
| `.claude/agents/scout.md` (Haiku) | Recherches larges en lecture seule, réponse ≤ 15 lignes | Délégation explicite |
| `.claude/agents/reviewer.md` (Sonnet) | Revue d'un diff : bugs, garde-fous, secrets, provenance, coût | Avant un commit important |

Les règles de conformité et la bible du personnage ne sont **pas** dupliquées en skills : elles vivent dans le code (`compliance.py`, `CORE_RULES`, `python -m agency character`) pour rester une source unique.
