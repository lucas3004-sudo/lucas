# Intégrations — état réel (2026-11-20)

| Service | Statut | Ce qui est fait | Ce qui manque |
|---|---|---|---|
| **ElevenLabs** | Implémenté, **non testé** | Client REST officiel (`xi-api-key`) : `GET /v1/user/subscription`, `GET /v2/voices`, `POST /v1/text-to-speech/{voice_id}` (modèle `eleven_multilingual_v2`, réglages stability/similarity/style/speed/speaker boost), stockage mp3, plafond de caractères/jour, journal d'usage | Docs non joignables depuis le conteneur de dev ; tester avec votre clé (Integrations › Tester). Génération désactivée par défaut (`voice_enabled`) car elle consomme vos crédits |
| **Alexya** | **Non intégré (API non vérifiée)** | Mode manuel : prompts cohérents (visage, signature, negative prompt SFW) à copier dans Alexya, Drop des résultats, montage automatique | Site/API inaccessibles depuis le conteneur. Une source tierce évoque une API REST + MCP : à confirmer avec la doc officielle et votre compte, puis brancher `image_provider=alexya` |
| **Claude API** | Implémenté, testé avec un client simulé | Routage Haiku/Sonnet/Opus, effort, JSON structuré, cache du préfixe, repli serveur sur refus, plafonds bloquants, coûts estimés | Clé API (facturée à part de Claude Pro) + `allow_paid_calls` |
| **ffmpeg** | **Vérifié** (local) | Vidéo 1080×1920 (zoom doux, textes, voix, mention IA), images 1080×1350 | — |
| Webhook | Implémenté, non testé | Discord / Slack / JSON générique | URL dans `.env` |
| Instagram Graph API | Non intégré | Publication = export manuel + checklist | Compte pro + app Meta validée (Content Publishing) |
| TikTok Content Posting API | Non intégré | Idem | App TikTok auditée (sinon publication privée seulement) |
| Statistiques plateformes | Non intégré | Saisie manuelle avec provenance `manual` | APIs officielles ci-dessus |

## Configurer
1. Copier `.env.example` en `.env`, renseigner les clés (jamais dans git).
2. Redémarrer, puis Dashboard › Integrations › **Tester** : seul un test réussi affiche « Vérifié ».
3. Pour la voix : Character Studio › Voix › « Lister mes voix » → choisir `voice_id` → Settings › `voice_enabled`.

## Alternatives autorisées si Alexya n'a pas d'API
Tout générateur doté d'une API officielle et de CGU compatibles (contenu non explicite, personnage fictif) peut être branché derrière `image_provider` : il suffit d'ajouter un module dans `agency/integrations/` et une branche dans `producer_generate`. Choix à faire avec l'utilisateur (coût, cohérence du visage).
