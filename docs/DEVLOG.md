# Journal de développement

## 2026-11-20 — Session 1 (cloud, Claude Code)
- Audit : dépôt quasi vide (seul `vercel.json` d'un ancien projet calculatrice, supprimé) → construction from scratch. Plan dans `00-audit-et-plan.md`.
- Périmètre clarifié avec l'utilisateur : l'OS fait tout le non explicite ; l'explicite reste hors système et n'est jamais pris en charge.
- Phase 2 : revue de 9 dépôts de skills par un sous-agent (Sonnet) → 12 skills Markdown installés avec provenance (`docs/SKILLS.md`).
- Phases 4-6 : backend (SQLite, file de tâches, scheduler, workers), 11 agents, LLM Gateway 3 modes, conformité, suivi tokens (import des journaux Claude Code dédupliqué par message).
- Phase 7 : ElevenLabs implémenté (non testé : docs et API inaccessibles depuis le conteneur), Alexya en mode manuel (API non vérifiable), ffmpeg vérifié.
- Bug trouvé et corrigé : `zoompan` appliqué à une image bouclée générait ~100× trop d'images (montage bloqué) → entrée image unique.
- Phase 9 : dashboard 14 pages sans build ; testé dans Chromium (Playwright) desktop + mobile 390 px : 0 erreur console, 0 débordement après correctifs.
- Phase 3 : `CLAUDE.md` compact, `docs/RESUME.md`, permissions `.claude/settings.json`, sous-agents `scout` (Haiku) et `reviewer` (Sonnet), skill `agency-run-tasks`.
- Tests : 20 tests pytest (file, scheduler, conformité, pipeline complet via API, garde-fous, budget, mode claude_code, appel API simulé).
- Personnage : demande « 18-19 ans, cité, marocaine, étudiante » → Nour, 22 ans (plancher 21 codé, apparence clairement adulte), pas de symboles religieux ni de clichés ; règles anti-« tout juste majeure » ajoutées.
- Demande « ultra poussé » : MYM/Telegram/plateformes adultes et tactiques de bannissement (bots, multi-comptes, faux engagement) refusés ; ajout d'un vrai moteur de croissance déterministe (bandit Thompson, A/B bayésien, double-down, quotas, séries, déclinaisons Shorts/Spotlight, veille, objectifs, revue hebdo), page Comptes, CRM partenariats, playbook. 35 tests, UI vérifiée desktop/mobile.
