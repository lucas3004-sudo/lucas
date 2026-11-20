# Phase 2 — Moteur d'agents

- **Date** : 20 novembre 2026
- **Décisions de référence** : D-003 (registre et trois modes), D-004 (API Messages + Tool Runner), D-006 (deux organisations), D-013 (apprentissage par agence).

## 1. Fiche d'agent (versionnée dans le code)

Chaque agent est un fichier TypeScript dans `packages/agents/definitions/`, validé par un schéma :

| Champ | Exemple | Rôle |
|---|---|---|
| `id`, `version` | `property-valuation`, `1.2.0` | Identité. Chaque mission enregistre la version utilisée |
| `name`, `department`, `director` | Property Valuation Agent, `property-intelligence`, `property-analysis-director` | Organisation, affichage dans l'Agent Center |
| `organization` | `produit` ou `entreprise` | Périmètre des données (D-006) |
| `mode` | `deterministe`, `assiste` ou `autonome` | Moteur d'exécution |
| `model`, `effort` | `claude-sonnet-5-5`, `medium` | Absents en mode déterministe |
| `tools` | `["dvf.comparables", "dpe.lookup", "finance.priceRange"]` | Liste fermée |
| `maxPermission` | `L1` | Plafond (permissions.md, section 4) |
| `budget` | `{ maxSteps: 8, maxInputTokens: 60000, maxOutputTokens: 4000, maxCostMicroUsd: 150000 }` | Arrêt garanti |
| `inputSchema`, `outputSchema` | schémas zod | Entrée validée ; sortie structurée et vérifiée |
| `validators` | `["no-invented-numbers", "sources-present", "disclaimer:estimation"]` | Contrôles QA automatiques |
| `instructions` | texte du prompt système | Instructions propres à l'agent |

**Synchronisation** : au démarrage, le worker enregistre les fiches dans `agent_definitions`, avec une empreinte (`definition_hash`). Une fiche modifiée sans changement de version bloque le démarrage. **Les permissions ne se modifient que par le code**, jamais depuis l'interface. L'interface permet seulement au gérant d'activer ou de désactiver un agent pour son agence.

## 2. Cycle de vie d'une mission

```
 en_file ──► en_cours ──► en_revue (validateurs) ──► reussie
    │            │  ▲            │
    │            ▼  │            └──► echec_validation ──► (1 nouvelle tentative guidée) ──► echouee
    │      attente_approbation ──(refus / expiration)──► annulee
    │      attente_sous_mission
    └──► annulee (par l'utilisateur ou par l'interrupteur d'arrêt)
```

Statut affiché d'un agent dans l'Agent Center, déduit de ses missions :
- **Working** : au moins une mission en cours ;
- **Waiting** : missions en attente d'approbation ou de sous-mission ;
- **Reviewing** : validation en cours ;
- **Failed** : dernier échec non acquitté ;
- **Disabled** : agent désactivé ;
- **Idle** : sinon.

## 3. Exécution selon le mode

| Mode | Déroulé |
|---|---|
| **Déterministe** | Appel d'une fonction de `packages/domain` avec les données des outils. Aucun appel au modèle. Résultat avec provenance |
| **Assisté** | Le code appelle les outils nécessaires, puis fait **un seul** appel au modèle avec les données préparées et une sortie structurée (schéma). Exemple : le Report Writer reçoit les chiffres calculés et rédige le texte, sans calculer |
| **Autonome** | Boucle d'outils (Tool Runner du SDK Anthropic TypeScript). Le modèle choisit ses outils dans la liste de la fiche, dans la limite de `maxSteps` et du budget. Exemples : le Copilot, le directeur Property Intelligence |

**Routeur** : une demande en langage naturel est d'abord classée par un appel court à Haiku 5.5 (agent cible, entités repérées). Les demandes simples vont directement à l'agent spécialisé. Les demandes composées vont au directeur concerné, qui crée des **sous-missions**. Celles-ci s'exécutent **en parallèle seulement si elles sont indépendantes**.

## 4. Passerelle d'outils (le point de contrôle unique)

Tout appel d'outil, par un agent ou par le Copilot, passe par une passerelle qui, dans l'ordre :
1. vérifie que l'outil figure dans la fiche de l'agent ;
2. compare le **niveau** de l'outil (L0 à L3) au plafond de la fiche ;
3. valide l'entrée (zod) ;
4. exécute l'outil dans `withTenant()` **avec l'identité de l'utilisateur demandeur** (la RLS s'applique donc) ;
5. pour un outil **L2 ou L3**, crée une **demande d'approbation**, passe la mission en `attente_approbation` et rend la main. Le modèle reçoit le résultat « approbation demandée ». L'action ne s'exécute qu'après la décision humaine ;
6. journalise l'étape dans `mission_steps` (entrée expurgée des données personnelles, durée, résultat) ;
7. renvoie au modèle un résultat **délimité et étiqueté comme donnée** (section 8).

## 5. Budgets et coûts

| Niveau | Mécanisme |
|---|---|
| Mission | `maxSteps`, plafonds de tokens, plafond de coût. Une mission arrêtée par le budget est marquée `echouee (budget)` et rend ce qu'elle a déjà trouvé, en le signalant |
| Agence | Quotas de la formule (`usage_ledger`). En cas de dépassement : refus poli avec le code `quota_exceeded`, et proposition d'un pack |
| Plateforme | Plafond quotidien global de dépense IA. Au-delà, les nouvelles missions IA sont suspendues et une alerte est envoyée à l'exploitant |
| Interrupteurs d'arrêt | Par agent, par agence, global. Ils sont effectifs à l'étape suivante de chaque mission en cours |

**Coût mesuré** : chaque réponse de l'API indique les tokens consommés (entrée, sortie, lecture en cache). Le coût est calculé avec `model_prices`, dont les tarifs sont datés, et enregistré par étape. L'Agent Center affiche les **coûts mesurés** et, à part, les **estimations** (cahier des charges, partie 12).

## 6. Paramètres d'appel au modèle

Contraintes relevées dans la documentation de l'API Claude (novembre 2026). Elles seront vérifiées de nouveau au moment du code, en phase 5.

| Sujet | Règle retenue |
|---|---|
| Modèles | Haiku 5.5 (`claude-haiku-5-5`) pour le routage, la classification et les explications courtes. Sonnet 5.5 (`claude-sonnet-5-5`) pour la rédaction, l'analyse et le Copilot. Opus 5.5 (`claude-opus-5-5`) pour le CEO et le Council (phase 7) |
| Réflexion et effort | Réflexion adaptative. **L'effort est fixé explicitement par agent**, car les valeurs par défaut diffèrent selon le modèle (`medium` pour Opus 5.5 et Haiku 5.5, `high` pour Sonnet 5.5). `low` pour les classifications, `medium` par défaut, `high` pour les analyses complexes |
| Outils | Définitions `strict: true`. Le choix d'outil forcé n'étant pas accepté par ces modèles, on utilise `auto` et des instructions explicites |
| Sorties structurées | Paramètre `output_config.format` avec un schéma, pour les agents assistés |
| Refus | Vérifier `stop_reason` avant de lire la réponse. Activer le repli automatique côté serveur (fonction bêta) et gérer proprement un refus |
| Cache de prompt | Instructions et définitions d'outils **stables et placées en premier**. Les données variables (date, agence, demande) viennent après le dernier point de cache. On vérifie l'efficacité du cache avec `cache_read_input_tokens` |
| Traitements de nuit | API Batch (−50 %) pour les explications de correspondances et les résumés non urgents |
| Erreurs | Erreurs temporaires (429, 5xx, réseau) : nouvelles tentatives du SDK, puis du job (3 au maximum, délai croissant). Erreurs de requête (400) : pas de nouvelle tentative, mission en échec avec diagnostic |

## 7. Validateurs QA (après chaque mission IA)

| Validateur | Vérification |
|---|---|
| `no-invented-numbers` | Chaque nombre du texte généré (prix, surface, pourcentage, date) doit figurer dans les résultats d'outils de la mission, ou en découler par un calcul tracé. Sinon : échec, puis une nouvelle tentative avec le signalement de l'écart |
| `sources-present` | Chaque section factuelle cite au moins une source de la mission |
| `missing-data-explicit` | Si un outil a renvoyé `manquante`, le texte le dit (il ne remplit pas le vide) |
| `disclaimer:*` | Présence des mentions requises : « estimation indicative », « simulation, pas un conseil », « contenu généré par IA » |
| `listing-mandatory-mentions` | Annonces : DPE (énergie et climat), estimation des dépenses d'énergie, Géorisques, copropriété, honoraires (fiche juridique, section 1.1) |
| `no-protected-criteria` | Matching et textes : aucune référence à un critère discriminatoire |

## 8. Défense contre l'injection de prompts

- Tout contenu externe (texte d'annonce importé, e-mail reçu, document, réponse d'une source) est transmis au modèle **à l'intérieur d'un bloc délimité, étiqueté « données non fiables »**. Les instructions système précisent que ce bloc ne contient jamais d'ordres.
- **Une action sensible ne peut jamais être déclenchée par du contenu** : tout outil L2 ou L3 passe par une approbation humaine (section 4).
- Les outils des agents qui lisent du contenu externe n'ont pas d'outil d'envoi dans leur liste (séparation lecture / action).
- Les opérateurs peuvent ajouter des consignes en cours de conversation par les messages système intermédiaires de l'API, canal prévu pour cela, jamais en insérant du texte dans les messages de l'utilisateur.

## 9. Mémoire

- **Mémoire d'agence** (`org_memory`) : préférences (« l'agence arrondit les estimations à 5 000 € près »), faits confirmés, retours sur les livrables. Elle est consultée **à la demande** par l'outil `memory.search`, jamais injectée en entier. Elle ne sort jamais de l'agence (D-013).
- **Résumés de mission** : chaque mission terminée produit un résumé court, réutilisable par les missions suivantes de la même agence. Cela évite de tout recalculer.
- **Cache de résultats vérifiés** : comparables DVF par commune et par millésime, rapport Géorisques par adresse (30 jours), loyers par commune et par millésime.

## 10. Organisation entreprise (phase 7, pour mémoire)

Elle utilise le même moteur, avec les fiches `organization: entreprise` et les tables du schéma `company`. Elle n'a accès qu'aux métriques agrégées et anonymisées. Le cycle de décision (proposition, revues parallèles, Devil's Advocate, arbitrage du CEO avec une réponse obligatoire à chaque objection, un seul tour de réplique) est décrit dans l'audit, section 6.4.
