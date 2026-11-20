# Reprise — état au 2026-11-20 (fin de session 1)

## État
- **Fonctionnel et testé** (40 tests, ≈ 14 s) : backend complet, 11 agents, pipeline RECHERCHE → ANALYSE avec approbation humaine, dashboard 14 pages (testé Chromium desktop + mobile), suivi tokens, rapport quotidien, garde-fous.
- Mode LLM par défaut : `offline` (gratuit, brouillons à base de modèles). Aucune dépense possible sans `allow_paid_calls` + clé.
- Branche : `claude/ai-agency-os-build-t1od41`.

## Ajouté (session 1, suite)
Moteur de croissance (bandit, double-down, A/B bayésien, quotas, séries, déclinaisons Shorts/Spotlight, veille santé, objectifs + projections, revue hebdo), page **Comptes**, Growth Center (Intelligence, Séries, Partenariats), playbook `agency-growth-playbook`. 35 tests.

Business : mentions légales FR automatiques, deals de marques → contenus sponsorisés → revenus, rentabilité, kit média + grille tarifaire (Finance). 40 tests.

## Problèmes connus / non vérifié
1. **ElevenLabs** : client écrit d'après l'API publique connue, **jamais testé** (réseau du conteneur bloqué). À tester avec la clé : Integrations › Tester.
2. **Alexya** : API **non vérifiée** (site inaccessible). Mode manuel en place (prompts → Alexya → Drop).
3. **API Anthropic** : testée uniquement avec un client simulé (pas de clé). Paramètre `fallbacks` (beta) non éprouvé en réel.
4. **Docker** : `docker compose config` valide, **image jamais construite** (pas de démon Docker dans le conteneur).
5. Publication et statistiques : manuelles (pas d'app Meta/TikTok validée).
6. Le mode `offline` produit des brouillons génériques ; la qualité créative vient des modes `claude_code` ou `api`.

7. **Faire valider par un juriste** la conformité à la loi influenceurs (mentions, catégories interdites, contrat d'agent si gestion pour tiers).

## Prochaines étapes (ordre conseillé)
1. Sur le PC de l'utilisateur : `pip install -e ".[api,dev]"`, `cp .env.example .env`, `python -m agency serve`, vérifier ffmpeg.
2. Personnage par défaut : **Nour**, 22 ans, franco-marocaine, cité de banlieue, étudiante en marketing digital (âge plancher 21, cf. DECISIONS #14). Affiner dans Character Studio puis enregistrer.
3. Ajouter `ELEVENLABS_API_KEY` → tester → choisir `voice_id` → activer `voice_enabled` (avec accord sur les crédits).
4. Vérifier l'API Alexya (docs officielles + compte) ; si elle existe : module `agency/integrations/alexya.py` + branche `image_provider=alexya` dans `producer_generate`, avec test réel.
5. Page Comptes : ajouter les comptes officiels (TikTok, Instagram, + Shorts/Spotlight pour les déclinaisons), quotas, bio avec mention IA, objectifs.
6. Saisir les stats des contenus publiés (vues, interactions, rétention) : c'est ce qui alimente le bandit, les A/B et les suites.
7. Essayer le mode `claude_code` : Settings › LLM = claude_code, LANCER, puis `/agency-run-tasks` dans Claude Code.
8. Décider de l'hébergement 24 h/24 (voir `DEPLOYMENT.md`) et, si souhaité, d'un budget API.

## Fichiers clés
`agency/agents/handlers.py` (pipeline) · `agency/llm/gateway.py` (modes) · `agency/api/routes.py` · `web/pages/*.js` · `agency/agents/compliance.py`
