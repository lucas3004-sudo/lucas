# Phase 2 — Modèle de données

- **Date** : 20 novembre 2026
- **Statut** : conception. Le schéma exact sera écrit en Drizzle en phase 3, avec les migrations et les tests RLS.

## 1. Conventions

| Sujet | Règle |
|---|---|
| Identifiants | `uuid` (`gen_random_uuid()`) |
| Agence | Colonne `org_id uuid NOT NULL` sur **chaque** table de données client, avec une politique RLS restrictive (architecture.md, section 3) |
| Horodatage | `created_at`, `updated_at` en `timestamptz` (UTC). `created_by` pour l'auteur |
| Argent | `bigint` en centimes, et `currency` (`EUR` par défaut) |
| Surfaces | `numeric(10,2)` en m² |
| Suppression | Logique (`deleted_at`) pour les données métier ; **physique** pour une demande d'effacement RGPD (art. 17), avec trace anonyme dans le journal d'audit |
| Énumérations | Types `text` avec contrainte `CHECK`, plus faciles à faire évoluer que les types `enum` de PostgreSQL |
| Schémas PostgreSQL | `app` : données client, sous RLS. `ref` : données publiques partagées, en lecture seule pour l'application. `ops` : files, journaux techniques. `company` : organisation entreprise (phase 7) |

## 2. Provenance des données (exigence centrale)

Chaque valeur affichée dans un dossier, une estimation ou une simulation porte un **statut** et une **source**.

| Statut | Signification | Exemple |
|---|---|---|
| `verifiee` | Issue d'une source officielle, identifiée et datée | Classe DPE lue dans la base ADEME pour cette adresse |
| `declaree` | Saisie par l'utilisateur ou un tiers, non vérifiée | Surface indiquée par le vendeur |
| `estimee` | Calculée par un modèle documenté, avec un intervalle | Fourchette de prix, loyer ANIL |
| `hypothese` | Paramètre choisi, modifiable | Taux de crédit à 3,5 %, vacance d'un mois |
| `manquante` | Introuvable, **affichée comme telle**, jamais remplacée par une invention | DPE absent de la base |

Forme JSON commune, dans l'API et dans les instantanés :
```json
{ "value": 2470, "unit": "EUR/m2", "status": "estimee",
  "source": { "id": "dvf", "label": "DVF (DGFiP / Etalab)", "asOf": "2026-06-30", "url": "…" },
  "interval": { "low": 1893, "high": 2957 }, "confidence": "moyenne" }
```

**Instantanés immuables.** Un dossier de bien ou un rapport est enregistré comme un instantané versionné (`analyses`), avec toutes ses valeurs et leur provenance. Un PDF exporté peut donc toujours être reproduit et expliqué, même après une mise à jour des données publiques.

## 3. Tables

### 3.1 Identité et agences (schéma `app`)

| Table | Colonnes principales | Remarques |
|---|---|---|
| `organizations` | `id`, `name`, `plan`, `siren`, `carte_t_numero`, `carte_t_expire_le`, `settings` (visibilité par défaut…) | Les champs de carte T préparent le suivi de conformité (hors MVP) |
| `users` | `id`, `email`, `name`, `mfa_enabled` | Gérée par la bibliothèque d'authentification |
| `memberships` | `user_id`, `org_id`, `role` (`gerant`, `manager`, `negociateur`, `assistant`, `lecture`, `systeme`), `active` | Lue par `app.ctx_role()`. Le rôle `systeme` sert aux tâches planifiées |
| `invitations` | `org_id`, `email`, `role`, `expires_at`, `accepted_at` | |
| `audit_log` | `org_id`, `actor_user_id`, `actor_agent_id`, `action`, `target_type`, `target_id`, `at`, `ip_hash`, `details` | En ajout seul. L'application ne peut ni modifier ni supprimer |
| `support_access_grants` | `org_id`, `granted_by`, `operator_id`, `expires_at`, `reason` | Accès support temporaire, explicite et journalisé |

### 3.2 CRM et activité

| Table | Colonnes principales | Remarques |
|---|---|---|
| `contacts` | `owner_user_id`, `visibility` (`private`, `agency`), `kind` (`acquereur`, `vendeur`, `investisseur`, `bailleur`, `autre`), `first_name`, `last_name`, `email`, `phone`, `source` | Détection des doublons par e-mail ou téléphone normalisés et par similarité de nom |
| `contact_consents` | `contact_id`, `channel` (`telephone`, `email`, `sms`), `status`, `obtained_at`, `expires_at`, `proof` | **Un appel ou envoi de prospection sans consentement valide est bloqué** (fiche juridique, section 1.2) |
| `buyer_profiles` | `contact_id`, `budget_max`, `types`, `surface_min`, `pieces_min`, `zones` (communes, rayon), `criteres` (liste fermée), `poids` (pondérations) | Base du Smart Matching. Aucun critère protégé n'est possible (liste fermée validée côté serveur) |
| `activities` | `contact_id`, `property_id`, `deal_id`, `type` (`appel`, `email`, `visite`, `note`, `rdv`), `occurred_at`, `summary` | Alimente le tableau de bord du gérant |
| `appointments` | `owner_user_id`, `contact_id`, `property_id`, `starts_at`, `ends_at`, `location`, `type` | Export calendrier `.ics` |
| `tasks` | `assignee_user_id`, `due_at`, `status`, `related_type`, `related_id`, `created_by_agent` | Relances. Un agent peut proposer une tâche (niveau L1) |
| `deals` | `property_id`, `buyer_contact_id`, `seller_contact_id`, `stage` (`offre`, `compromis`, `conditions`, `acte`, `abandon`), `price`, `fees`, `key_dates` | Transactions, version légère |
| `deal_documents` | `deal_id`, `kind`, `required`, `status`, `document_id`, `due_at` | Liste de pièces par étape |

### 3.3 Biens et analyses

| Table | Colonnes principales | Remarques |
|---|---|---|
| `properties` | `owner_user_id`, `visibility`, `status` (`prospect`, `mandat`, `sous_offre`, `vendu`, `retire`), `type`, `address_label`, `ban_id`, `insee_code`, `geom` (PostGIS), `surface`, `pieces`, `price_asked`, `dpe_class`, `dpe_date`, `copro_lots`, `charges_annuelles`, `origin` (`saisie`, `import`, `flux`) | Les champs saisis ont le statut `declaree` |
| `property_media` | `property_id`, `object_key`, `kind`, `position` | Photos et plans, stockage privé |
| `analyses` | `property_id` (ou adresse seule), `kind` (`dossier`, `estimation`, `investissement`), `version`, `snapshot` (JSON avec provenance), `inputs_hash`, `created_by`, `mission_id` | **Immuable.** Un nouveau calcul crée une nouvelle version |
| `investment_scenarios` | `property_id`, `assumptions` (JSON d'hypothèses), `results` (JSON), `created_by` | Hypothèses toujours visibles et modifiables |
| `listings_drafts` | `property_id`, `channel`, `text`, `ai_generated` (booléen), `mentions_check` (JSON), `validated_by`, `validated_at` | Marquage IA (AI Act, art. 50) et contrôle des mentions obligatoires |
| `saved_searches` | `owner_user_id`, `criteria`, `alert_frequency` | Opportunity Finder v1 |
| `matches` | `property_id`, `buyer_profile_id`, `score`, `explanation` (JSON : critères remplis, manquants, poids), `computed_at`, `status` (`nouveau`, `propose`, `ecarte`) | Recalculé à chaque nouveau bien ou profil |
| `documents` | `object_key`, `filename`, `mime`, `size`, `related_type`, `related_id`, `uploaded_by` | |
| `imports` | `kind` (`contacts`, `biens`), `source_software`, `status`, `rows_ok`, `rows_error`, `report` | Import CSV depuis Hektor, Apimo ou Modelo |

### 3.4 Agents (détail dans moteur-agents.md)

| Table | Colonnes principales |
|---|---|
| `agent_definitions` | `id`, `version`, `department`, `director_id`, `mode`, `model`, `max_permission`, `tools`, `budget`, `definition_hash`, `enabled` (copie en base des fiches versionnées dans git) |
| `missions` | `org_id`, `agent_id`, `agent_version`, `requested_by`, `parent_mission_id`, `input`, `status`, `priority`, `budget`, `deadline`, `result_ref`, `error` |
| `mission_steps` | `mission_id`, `seq`, `kind` (`llm`, `tool`, `validation`, `approval`), `name`, `input_redacted`, `output_ref`, `started_at`, `ended_at`, `tokens_in`, `tokens_out`, `cache_read`, `cost_micro_usd`, `status` |
| `approvals` | `org_id`, `mission_id`, `level` (`L2`, `L3`), `action`, `payload_preview`, `requested_at`, `decided_by`, `decision`, `decided_at`, `expires_at` |
| `usage_ledger` | `org_id`, `period`, `meter` (`dossier`, `copilot_message`, `annonce`…), `quantity`, `cost_micro_usd_measured` |
| `model_prices` | `model`, `input_per_mtok`, `output_per_mtok`, `cache_read_per_mtok`, `valid_from` (coûts recalculables après une hausse de prix) |
| `org_memory` | `org_id`, `kind` (`preference`, `fait`, `retour`), `content`, `source_mission_id`, `created_at` (mémoire de l'agence, apprentissage interne : D-013) |
| `conversations`, `messages` | Historique du Copilot, avec l'agence et l'utilisateur |

### 3.5 Données publiques (schéma `ref`, sans RLS, lecture seule pour l'application)

| Table | Contenu | Clé et index |
|---|---|---|
| `ref.dvf_mutations` | Une ligne par vente **nettoyée** : date, nature (ancien ou neuf), type, valeur, surface, pièces, terrain, `geom`, commune, règles appliquées | Index spatial sur `geom`, et (`insee_code`, `type`, `date`) |
| `ref.dvf_raw` | Lignes brutes du millésime en cours (pour pouvoir rejouer le nettoyage) | Purgées après validation |
| `ref.dpe` | DPE utiles : identifiant ADEME, `ban_id`, adresse, date, classes énergie et climat, consommation, estimation des coûts, surface, type | (`ban_id`), (`insee_code`) |
| `ref.loyers` | Loyers ANIL par commune et par type : valeur, intervalle, R², nombre d'observations, millésime | (`insee_code`, `type`, `millesime`) |
| `ref.zonage_abc` | Zone par commune, date d'entrée en vigueur | (`insee_code`) |
| `ref.bpe` | Équipements : type, `geom` | Index spatial |
| `ref.risks_cache` | Rapport Géorisques par adresse, avec sa date d'obtention | (`ban_id`), durée de validité 30 jours |
| `ref.source_runs` | Chaque ingestion : source, millésime, URL, date, lignes lues, retenues, rejetées, statut | Affichage de la fraîcheur des données |

### 3.6 Organisation entreprise (schéma `company`, phase 7)

`proposals`, `reviews`, `objections`, `decisions`, `experiments`, `company_memory` (voir l'audit, section 6.4). **Ces tables ne contiennent aucune donnée personnelle de client** (D-006).
