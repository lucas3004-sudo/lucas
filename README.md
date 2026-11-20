# AI Agency OS

Agence de contenu pilotée par 11 agents IA (37 rôles), pour une créatrice virtuelle **présentée comme IA**, sur TikTok et Instagram.
**Contenus non explicites uniquement.** Un tableau de bord unique, un bouton « LANCER L'AGENCE », vous validez avant toute publication.

## Démarrer (5 minutes)
```bash
python3 -m venv .venv && .venv/bin/pip install -e ".[api,dev]"
cp .env.example .env
.venv/bin/python -m agency serve         # → http://127.0.0.1:8000
```
Windows : `py -m venv .venv` puis `.venv\Scripts\pip install -e ".[api,dev]"` et `.venv\Scripts\python -m agency serve`. ffmpeg requis pour le montage.

## Ce que fait l'agence
1. **Recherche** tendances / concurrents (données légales) → 2. **Stratégie** (briefs + 1 expérience A/B) → 3. **Contestation** (Devil's Advocate + conformité)
→ 4. **Concept & script** → 5. **Optimisation plateforme** → 6. **Prompts** image/vidéo/voix → 7. **Génération** (voix ElevenLabs ; visuels : vous les générez dans Alexya et les déposez dans le *Generator*)
→ 8. **Montage** ffmpeg (mention IA incrustée) → 9. **Contrôle qualité** → 10. **Votre validation** → 11. **Planification** → 12. **Paquet de publication** → 13. **Analyse** et amélioration continue.

## Les 3 modes d'intelligence (Settings)
| Mode | Coût | Usage |
|---|---|---|
| `offline` (défaut) | 0 | Brouillons à partir de modèles : pour tester et faire tourner le pipeline |
| `claude_code` | quota Claude Pro | Les agents déposent des tâches ; dans Claude Code tapez `/agency-run-tasks` |
| `api` | payant, plafonné | Clé Anthropic + autorisation explicite + budgets jour/mois |

## Garde-fous (non désactivables)
Contenu adulte désactivé · validation humaine avant publication · mention « personnage IA » · aucune dépense sans accord · aucun chiffre inventé (provenance affichée partout) · clés uniquement dans `.env`.

## Documentation
`docs/RESUME.md` (état & prochaines étapes) · `docs/ARCHITECTURE.md` · `docs/INTEGRATIONS.md` · `docs/TOKEN_OPTIMIZATION.md` · `docs/DEPLOYMENT.md` · `docs/SKILLS.md` · `docs/DECISIONS.md` · `docs/DEVLOG.md`

Tests : `.venv/bin/python -m pytest -q`
