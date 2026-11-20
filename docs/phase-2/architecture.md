# Phase 2 — Architecture détaillée

- **Date** : 20 novembre 2026
- **Statut** : prête pour la phase 3
- **Documents liés** :
  - [Modèle de données](modele-donnees.md)
  - [Permissions](permissions.md)
  - [Moteur d'agents](moteur-agents.md)
  - [Ingestion des données](ingestion.md)
- **Prototypes exécutés** :
  - `prototypes/rls/run.sh` : isolation entre agences, **12 tests sur 12 réussis** ;
  - `prototypes/dvf/clean_dvf.py` : règles de nettoyage DVF mesurées sur Amiens.

## 1. Organisation du code (monorepo)

```
apps/
  web/            Next.js : interface + API REST /api/v1 (authentification, validation, quotas)
  worker/         Node.js : files pg-boss, moteur d'agents, ingestion, génération PDF, alertes
packages/
  db/             Schéma Drizzle, migrations SQL, politiques RLS, fonction withTenant()
  domain/         Fonctions pures et testées : finance, estimation, matching, nettoyage DVF, scores
  integrations/   Un adaptateur par source (BAN, DVF, ADEME, Géorisques, loyers, zonage, BPE, cadastre)
  agents/         Registre des agents, moteur d'exécution, outils, validateurs QA
  ui/             Design system : jetons de couleur et de typographie, composants
  config/         Configurations partagées (TypeScript, lint, tests)
prototypes/       Expériences de validation, jamais déployées
scripts/          Outils d'exploitation (vérification des sources…)
docs/             Documentation, décisions, progression
```

**Règle de dépendance** :
- `domain` ne dépend de rien : aucun accès au réseau ni à la base, ce qui le rend testable à 100 % ;
- `integrations` et `db` dépendent de `domain` ;
- `agents` dépend des trois ;
- les applications assemblent le tout.

Un contrôle automatique dans la CI refuse toute dépendance dans le mauvais sens.

## 2. Processus en production

| Processus | Rôle | Mise à l'échelle |
|---|---|---|
| `web` | Pages, API, authentification. Met en file les tâches longues | Plusieurs instances sans état |
| `worker` | Exécute les tâches (agents, ingestion, PDF, alertes) et les tâches planifiées | Une ou plusieurs instances, concurrence réglée par file |
| PostgreSQL 16 + PostGIS | Données, file pg-boss, mémoire, journaux | Service managé, sauvegardes et restauration à un instant donné |
| Stockage objet (S3, UE) | Documents, photos, PDF | Service managé |

**Circuit d'une demande longue** (exemple : « analyse ce bien »)
1. `web` valide la demande, vérifie le quota et crée une mission en base (statut `en file`).
2. `web` publie un job pg-boss et renvoie l'identifiant de la mission.
3. `worker` exécute la mission (voir moteur-agents.md). Chaque étape est journalisée.
4. L'interface suit l'avancement par interrogation périodique au MVP (flux en temps réel plus tard).
5. Le résultat est un **instantané immuable** (dossier, rapport) avec la provenance de chaque valeur.

## 3. Isolation entre agences (validée par prototype)

**Mécanisme**, testé dans `prototypes/rls/` :

1. **Trois rôles PostgreSQL**
   - `app_owner` : propriétaire des tables, utilisé seulement pour les migrations ;
   - `app_user` : utilisé par `web` et `worker`, ni propriétaire ni `BYPASSRLS` ;
   - `app_ingest` : écriture dans le schéma `ref` des données publiques uniquement.
2. **Contexte par transaction.** Toute requête sur des données client passe par `withTenant({ orgId, userId }, fn)`. Cette fonction ouvre une transaction, fixe `app.org_id` et `app.user_id` en mode **transaction** (`set_config(…, true)`), puis exécute `fn`.
3. **La base vérifie l'appartenance.** La fonction `app.ctx_role()` lit le rôle de l'utilisateur dans l'agence courante. Un bug qui fixerait une agence dont l'utilisateur n'est pas membre ne donne accès à **rien** (test T5).
4. **Une politique RESTRICTIVE d'isolation** par agence sur chaque table client, plus des **politiques PERMISSIVES** de visibilité selon le rôle. Une erreur dans une règle de visibilité ne peut pas ouvrir l'accès à une autre agence.
5. **`FORCE ROW LEVEL SECURITY`** sur chaque table client.

**Enseignements du prototype**
- **Défaut trouvé et corrigé** : avec `FORCE`, la RLS s'applique aussi au propriétaire. Il faut une politique explicite pour que la fonction `SECURITY DEFINER` puisse lire les adhésions, sinon plus personne n'a accès.
- **Les tests de refus doivent toujours avoir un contrôle positif.** Sans lui, un test « 0 ligne touchée » réussit même quand rien ne fonctionne. C'est ce qui s'est passé au premier essai.
- **Le mode session fuit** (test T11 : 100 003 lignes visibles dans la requête suivante). `set_config(…, false)` et `SET` sans `LOCAL` sont donc **interdits** dans le code, et une règle de lint le vérifie.
- **Performance** : la fonction de rôle est évaluée une seule fois par requête (« InitPlan »). Compter 100 003 lignes prend de 8 à 17 ms.

**Garde-fou automatique (phase 3)** : un test de CI liste toutes les tables qui ont une colonne `org_id` et **échoue** si l'une d'elles n'a pas la RLS activée et forcée, ou n'a pas de politique restrictive. Aucune table ne peut être oubliée.

**À vérifier en phase 3** : la bibliothèque d'authentification (Better Auth, extension « organisation ») a ses propres tables de membres. Les politiques RLS devront lire **cette** table (ou une vue synchronisée), sans en dupliquer la logique.

## 4. Conventions d'API

| Sujet | Règle |
|---|---|
| Forme | REST JSON, préfixe `/api/v1`, noms de ressources au pluriel (`/properties`, `/contacts`) |
| Validation | Schéma zod en entrée **et** en sortie. Champs inconnus refusés |
| Erreurs | Format standard `application/problem+json` (RFC 9457) avec un code stable (`quota_exceeded`, `approval_required`…) |
| Pagination | Par curseur (`?cursor=…&limit=50`, au plus 200) |
| Tâches longues | `202 Accepted` + identifiant de mission. En-tête `Idempotency-Key` obligatoire pour éviter les doublons en cas de double clic |
| Dates et montants | Dates ISO 8601 en UTC. Montants en **centimes entiers** (pas de flottants pour l'argent). Surfaces en m² décimaux |
| Provenance | Toute valeur calculée ou externe est renvoyée sous la forme `{ value, status, source, asOf }` (voir modele-donnees.md) |
| Limitation de débit | Par utilisateur et par agence. Les quotas de formule sont décomptés dans `usage_ledger` |
| Versionnement | Rupture de compatibilité = `/api/v2`. Une API publique (formule Business) viendra plus tard |

## 5. Environnements

| Environnement | Données | Usage |
|---|---|---|
| Local | Agences de démonstration générées (**étiquetées « données fictives »**) + données publiques réelles | Développement |
| Préproduction | Même chose, en ligne dès la phase 3 | Démonstrations, tests de bout en bout, bêta interne |
| Production | Données réelles des agences | Après la phase 9 (audit) |

- Les secrets sont stockés uniquement chez l'hébergeur. `.env.example` sans valeurs dans le dépôt.
- **Aucune donnée de production ne descend vers la préproduction.**

## 6. Stratégie de tests

| Niveau | Outil | Ce qui est testé | Quand |
|---|---|---|---|
| Unitaire | Vitest | `packages/domain` : formules financières (cas calculés à la main), estimation, matching, nettoyage DVF (cas tirés du prototype) | Chaque commit |
| Intégration base | Vitest + vrai PostgreSQL (service de CI) | Migrations, **tests d'attaque RLS** (repris du prototype), garde-fou « aucune table oubliée » | Chaque commit |
| Contrats de sources | Vitest + réponses enregistrées | Chaque adaptateur d'intégration, sur des réponses réelles enregistrées | Chaque commit |
| Sources en direct | `scripts/check-data-sources.sh` | Disponibilité et format réel des sources | Chaque nuit + avant chaque mise en production |
| Bout en bout | Playwright | Parcours clés : inscription, dossier de bien, matching, Copilot | Chaque fusion, en préproduction |
| Agents IA | Jeux d'évaluation (cas de référence) + validateurs automatiques | Pas de chiffre inventé, sources présentes, mentions obligatoires, refus des actions non autorisées | Chaque modification d'un agent |
| Sécurité | Analyse des dépendances, recherche de secrets, en-têtes HTTP | Phase 3, puis en continu |

**Règle** : une fonctionnalité n'est « terminée » que si ses critères d'acceptation (voir `docs/phase-1-strategie.md`) sont couverts par des tests automatiques qui passent.

## 7. Sécurité (socle de la phase 3)
- Sessions en base, cookies `HttpOnly`, `Secure`, `SameSite=Lax`, vérification de l'origine sur les requêtes qui modifient des données.
- Double authentification obligatoire pour le rôle gérant, proposée aux autres.
- En-têtes : politique de sécurité du contenu (CSP) stricte, HSTS, `X-Content-Type-Options`.
- Moindre privilège en base (trois rôles, section 3). Requêtes paramétrées uniquement (Drizzle), aucune concaténation SQL.
- Fichiers téléversés : type vérifié, taille limitée, stockage privé, accès par URL signée de courte durée.
- Journal d'audit : connexions, exports, suppressions, changements de rôle, approbations, accès support.
- **Accès support de l'exploitant** : il est impossible par défaut. Il s'ouvre seulement sur autorisation explicite du gérant, pour une durée limitée et journalisée.
- Sauvegardes quotidiennes et restauration à un instant donné. **Une restauration est testée chaque mois.**
- Défenses contre l'injection de prompts : voir moteur-agents.md, section 8.

## 8. Observabilité
- Logs structurés (JSON) avec identifiant de requête et de mission. **Aucune donnée personnelle en clair dans les logs.**
- Tableaux internes, issus de nos tables : missions par statut, échecs, latence, **coût IA mesuré** par agent, par agence et par jour.
- Alertes : source critique indisponible, taux d'échec des agents supérieur à 5 %, dépassement du budget IA quotidien.
