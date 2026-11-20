"""Agent registry: 37 requested roles grouped into 11 agents (see docs/ARCHITECTURE.md).
`instructions` are the ONLY per-agent prompt text (short, centralised); shared rules live in llm/gateway.CORE_RULES.
`skills` = Claude Code skills to load on demand in claude_code mode (progressive disclosure)."""
from __future__ import annotations

AGENTS: dict[str, dict] = {
    "orchestrator": {
        "name": "Orchestrator", "roles": ["CEO", "Project Manager"],
        "mission": "Planifier chaque run, répartir le travail, suivre l'avancement et clôturer.",
        "instructions": "Deterministic: size the run from account quotas (3-day deficit), reserve slots to double down on winners.",
        "tools": ["db.read", "queue.enqueue"], "tier": "none", "skills": [],
        "limits": {"llm_calls_per_run": 0}, "jobs": ["orchestrator.plan", "orchestrator.autolaunch"],
        "success": ["run créé avec N briefs", "aucune tâche orpheline", "run clôturé avec résumé"],
        "handoff": ["research"],
    },
    "research": {
        "name": "Research", "roles": ["Market Research", "Competitor Analysis", "Trend Research"],
        "mission": "Repérer tendances, formats et opportunités à partir de données légalement accessibles.",
        "instructions": "Return trends, competitor patterns (patterns only, never copy) and opportunities for the niche. "
                        "Use only the provided competitor notes and insights; mark anything else as hypothesis with confidence.",
        "tools": ["db.read", "research_items.write", "web_search (claude_code mode only)"], "tier": "standard",
        "skills": ["trend-radar", "competitor-analysis", "platform-fluency"],
        "limits": {"llm_calls_per_run": 1, "max_output_tokens": 1500}, "jobs": ["research.scan", "research.niche_lab"],
        "success": ["≥3 tendances sourcées ou marquées hypothèse", "0 chiffre inventé"], "handoff": ["growth"],
    },
    "growth": {
        "name": "Growth", "roles": ["Growth Director", "Virality Analyst", "Experimentation"],
        "mission": "Transformer la recherche en stratégie : briefs de contenus et une expérience mesurable par run.",
        "instructions": "For each given slot (platform/pillar/format fixed by the bandit), write one brief: a specific, "
                        "searchable angle and a scroll-stopping hook idea (<12 words, curiosity or tension, no clickbait lie). "
                        "Respect the running A/B experiment variable. Favour series-able ideas and saves/shares-driving value.",
        "tools": ["db.read", "experiments.write", "growth.bandit", "growth.winners"], "tier": "standard",
        "skills": ["agency-growth-playbook", "hook-anatomy", "trend-radar"],
        "limits": {"llm_calls_per_run": 1, "max_output_tokens": 1500}, "jobs": ["growth.strategy"],
        "success": ["1 brief par slot du bandit", "expérience A/B en cours alimentée (A et B alternés)", "suites des gagnants planifiées"],
        "handoff": ["reviewer"],
    },
    "reviewer": {
        "name": "Reviewer", "roles": ["Devil's Advocate", "Compliance", "Quality Control"],
        "mission": "Contester la stratégie, bloquer tout contenu non conforme et noter la qualité avant validation humaine.",
        "instructions": "Challenge the briefs: list concrete risks (repetition, weak hook, compliance, platform rules) "
                        "and keep/drop each brief. Be strict and short.",
        "tools": ["compliance.rules", "db.read"], "tier": "simple", "skills": ["platform-fluency", "crisis-and-moderation"],
        "limits": {"llm_calls_per_run": 1, "max_output_tokens": 800}, "jobs": ["reviewer.challenge", "reviewer.qc"],
        "success": ["0 contenu non conforme envoyé en validation", "score QC justifié"], "handoff": ["creative", "planner"],
    },
    "creative": {
        "name": "Creative", "roles": ["Content Director", "Concept Creator", "Scriptwriter"],
        "mission": "Écrire concept, hook, script séquencé et légende fidèles au personnage.",
        "instructions": "Write concept, hook (<12 words, payoff promised in the first 2 s, matches hook_type), a timed script "
                        "(beats: visual, on-screen text, voiceover) within target_duration_s with a pattern interrupt every 3-5 s "
                        "and a loopable ending, caption with one clear CTA (comment/save/share). Series: keep the recurring "
                        "intro and episode number. follow_up_of: a real part 2 that references the original. sponsor: integrate the brand naturally "
                        "and honestly (no exaggerated or health claims), keep it useful for the viewer. Character's tone.",
        "tools": ["db.read"], "tier": "standard", "skills": ["tiktok-script", "storytelling-and-narrative", "hook-anatomy", "agency-growth-playbook"],
        "limits": {"llm_calls_per_content": 2, "max_output_tokens": 1800}, "jobs": ["creative.develop"],
        "success": ["hook < 12 mots", "script complet", "ton du personnage respecté"], "handoff": ["platform"],
    },
    "platform": {
        "name": "Platform", "roles": ["TikTok Strategist", "Instagram Strategist", "Hashtag & SEO"],
        "mission": "Adapter légende, hashtags et mots-clés à chaque plateforme.",
        "instructions": "Optimise caption for the platform (keep AI disclosure; first line = searchable keyword phrase), "
                        "niche hashtags within the platform limit incl. #IA, 3-5 social-search keywords.",
        "tools": ["db.read"], "tier": "simple", "skills": ["platform-fluency"],
        "limits": {"llm_calls_per_content": 1, "max_output_tokens": 600}, "jobs": ["platform.optimize"],
        "success": ["hashtags pertinents ≤ limite", "mention IA présente"], "handoff": ["prompt"],
    },
    "prompt": {
        "name": "Prompt Engineer", "roles": ["Prompt Engineer"],
        "mission": "Produire des prompts image/vidéo/voix cohérents avec l'identité visuelle, strictement non explicites.",
        "instructions": "Write one image prompt per key shot (consistent face/hair/signature), a video prompt, and the voiceover text. "
                        "Always fully-clothed everyday outfits; include the given negative prompt.",
        "tools": ["db.read"], "tier": "simple", "skills": [],
        "limits": {"llm_calls_per_content": 1, "max_output_tokens": 1200}, "jobs": ["prompt.build"],
        "success": ["1 prompt par plan clé", "negative prompt SFW présent"], "handoff": ["producer"],
    },
    "producer": {
        "name": "Producer", "roles": ["Image Generation", "Video Production", "Voice", "Editing", "Caption"],
        "mission": "Générer/collecter les médias, la voix et monter la version finale.",
        "instructions": "Tool-driven (ElevenLabs, image provider, ffmpeg). No LLM.",
        "tools": ["elevenlabs.tts", "image_provider", "ffmpeg", "storage"], "tier": "none", "skills": [],
        "limits": {"voice_daily_char_cap": "settings"}, "jobs": ["producer.generate", "producer.edit"],
        "success": ["fichier final 1080x1920 (vidéo) ou 1080x1350 (image)", "mention IA incrustée"], "handoff": ["reviewer"],
    },
    "planner": {
        "name": "Planner", "roles": ["Social Media Manager", "Content Calendar"],
        "mission": "Planifier les contenus validés sur chaque compte, décliner les vidéos vers YouTube Shorts / Snapchat Spotlight "
                   "(validées avec le parent) et préparer les publications (export manuel tant qu'aucune API n'est vérifiée).",
        "instructions": "Deterministic slotting from settings.posting_hours. No LLM.",
        "tools": ["db.write", "storage.export"], "tier": "none", "skills": [],
        "limits": {}, "jobs": ["planner.schedule", "publisher.prepare"],
        "success": ["aucun doublon de créneau", "paquet d'export complet"], "handoff": ["analyst"],
    },
    "community": {
        "name": "Community", "roles": ["Community Manager", "Conversation Assistant", "Sentiment Analysis", "Customer Support", "Conversation Quality"],
        "mission": "Classer les messages, mesurer le sentiment, proposer des réponses transparentes et escalader le sensible.",
        "instructions": "For each message: category, sentiment (-1..1), priority, a short reply draft in the character's tone "
                        "(never claim to be human; say you're an AI creator if asked), or escalate with a reason.",
        "tools": ["messages.read", "messages.write"], "tier": "simple",
        "skills": ["read-the-room", "reply-and-comment-writer", "crisis-and-moderation", "objection-handling"],
        "limits": {"batch_size": 20, "max_output_tokens": 1500}, "jobs": ["community.triage", "community.outreach_draft"],
        "success": ["100 % des messages classés", "sensible → humain"], "handoff": [],
    },
    "analyst": {
        "name": "Analyst", "roles": ["Analytics", "Finance", "Token Optimization", "Daily Reporting"],
        "mission": "Mesurer, apprendre (indice de performance, bandit, A/B bayésien, créneaux), surveiller la santé des comptes, "
                   "suivre coûts et tokens, écrire le rapport quotidien et la revue hebdo.",
        "instructions": "Deterministic aggregation from DB. No LLM.",
        "tools": ["db.read", "briefs.write"], "tier": "none", "skills": ["analytics-and-reporting"],
        "limits": {}, "jobs": ["analyst.analyze", "analyst.learn", "analyst.daily_brief", "analyst.watch", "analyst.weekly_review", "analyst.morning_todo"],
        "success": ["rapport quotidien + revue hebdo écrits", "expériences conclues avec statistiques", "alertes de santé des comptes",
                    "chaque chiffre avec provenance"], "handoff": ["orchestrator"],
    },
}

JOB_AGENT = {j: a for a, spec in AGENTS.items() for j in spec["jobs"]}
