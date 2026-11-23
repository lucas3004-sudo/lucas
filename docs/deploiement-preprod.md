# Préproduction — procédure de déploiement

- **Mise en place** : 20 novembre 2026 (décision D-020 : offres gratuites)
- **Base de données** : Supabase, projet `immopilot-preprod` (référence `kverrkvuhzuuoudvnndw`), région Paris (`eu-west-3`), PostgreSQL 17, PostGIS 3.3
- **Site** : Vercel (offre Hobby), région Paris (`cdg1`), dossier racine `apps/web`, branche `main`

## 1. Rôles PostgreSQL en préproduction

| Rôle | Utilisé par | Où vit son mot de passe |
|---|---|---|
| `app_user` | Le site (données des agences, sous RLS) | Variable `DATABASE_URL` chez Vercel |
| `app_auth` | Le site (bibliothèque d'authentification, schéma `iam`) | Variable `DATABASE_URL_AUTH` chez Vercel |
| `app_owner` | Migrations uniquement | **Jamais chez Vercel.** Les migrations sont appliquées par Claude via le connecteur Supabase |
| `app_ingest` | Ingestion des données publiques (phase 4) | Non utilisé pour l'instant |

Les mots de passe ont été générés aléatoirement (24 octets). Ils ne figurent ni dans le dépôt ni dans la documentation. **Pour les changer**, exécuter `ALTER ROLE … PASSWORD …` dans l'éditeur SQL de Supabase, puis mettre à jour la variable correspondante chez Vercel.

## 2. Appliquer une nouvelle migration (avant chaque déploiement qui en contient une)
1. La tester en local et en CI (`pnpm test:integration`, tests de bout en bout).
2. L'appliquer sur Supabase **sous le rôle `app_owner`**, dans une transaction explicite, en enregistrant son empreinte SHA-256 dans `ops.schema_migrations` (même empreinte que `packages/db/src/migrate.ts`).
3. Vérifier par une requête que les objets sont dans le bon schéma.
4. Seulement ensuite, fusionner le code dans `main` (Vercel déploie automatiquement).

Contrôle effectué le 20/11/2026 après les migrations 0001 à 0004 : test d'attaque de l'isolation **sur Supabase même**, dans une transaction annulée :
- sans contexte : 0 ligne, écriture refusée ;
- rôle lu par la base : gérant ;
- contrôle positif : 1 ligne ;
- écriture dans une autre agence : refusée ;
- modification du journal : refusée ;
- contexte d'une agence non membre : 0 ligne ;
- accès au schéma `iam` : refusé.

## 3. Variables d'environnement chez Vercel

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | `postgresql://app_user.kverrkvuhzuuoudvnndw:<mot de passe>@aws-1-eu-west-3.pooler.supabase.com:6543/postgres` |
| `DATABASE_URL_AUTH` | `postgresql://app_auth.kverrkvuhzuuoudvnndw:<mot de passe>@aws-1-eu-west-3.pooler.supabase.com:6543/postgres` |
| `BETTER_AUTH_SECRET` | Valeur aléatoire de 32 octets |
| `NEXT_TELEMETRY_DISABLED` | `1` |

- `BETTER_AUTH_URL` est **facultative** : l'application utilise automatiquement l'adresse de production fournie par Vercel (`VERCEL_PROJECT_PRODUCTION_URL`).
- Le port 6543 est le mode « transaction » du répartiteur. Il est compatible avec `withTenant()`, car le contexte d'agence est fixé par transaction.

## 4. Limites connues de la préproduction
- **Vercel Hobby : usage non commercial uniquement.** Il faudra changer d'offre ou d'hébergeur avant toute vente.
- **Supabase gratuit : mise en veille après une semaine sans activité.** On la réactive depuis le tableau de bord.
- **Pas de vérification d'e-mail** (D-023) : la préproduction ne doit contenir **que des comptes de test**, jamais de données réelles d'agence.
- Connexion : l'authentification accepte l'adresse principale, l'adresse propre au déploiement (`VERCEL_URL`) et celle de sa branche (`VERCEL_BRANCH_URL`), fournies par Vercel pour ce projet seulement. Toute autre origine est refusée (403 « INVALID_ORIGIN »). Pour un domaine personnalisé, ajouter la variable `AUTH_TRUSTED_ORIGINS` (adresses en https, séparées par des virgules).

## 5. Répartiteur de connexions (identifié le 20/11/2026)
L'hôte du répartiteur n'est pas déductible de la référence du projet. Il a été identifié par une tentative de connexion volontairement fausse, depuis GitHub Actions (aucun secret utilisé) :
- `aws-0-eu-west-3.pooler.supabase.com` : « tenant/user not found », donc ce n'est pas le bon ;
- `aws-1-eu-west-3.pooler.supabase.com` : « password authentication failed », donc **c'est le bon**. Il reconnaît aussi les rôles `app_user` et `app_auth`.

## 6. Attribuer une formule à une agence (D-048)
Il n'y a pas encore de paiement en ligne : la formule est attribuée par l'exploitant. Sans attribution, l'agence est en « Essai » (sans IA). Le rôle de l'application ne peut que **lire** la formule. Seul le propriétaire du schéma (`app_owner`) peut l'écrire, et l'opération reste tracée par `updated_at`.

Dans l'éditeur SQL de Supabase (ou `psql` avec le rôle propriétaire) :

```sql
BEGIN;
SET LOCAL ROLE app_owner;
-- Retrouver l'agence par son nom (jamais par une donnée personnelle).
SELECT id, name FROM iam.organization WHERE name ILIKE '%nom de l''agence%';
-- Attribuer la formule : essai, investisseur, solo, pro ou agency ; extra_seats pour Agency seulement.
INSERT INTO app.agency_plans (org_id, plan, extra_seats, note)
VALUES ('<id de l''agence>', 'agency', 2, 'Bêta : accord du 2026-12-01')
ON CONFLICT (org_id) DO UPDATE SET plan = EXCLUDED.plan, extra_seats = EXCLUDED.extra_seats, note = EXCLUDED.note, updated_at = now();
COMMIT;
```

Supprimer la ligne remet l'agence en Essai. Une baisse de formule ne supprime rien : les éléments déjà créés restent. Seuls les nouveaux ajouts au-delà du quota sont refusés.

## 7. Charger les données publiques (DVF, loyers, zonage)
Elles se chargent depuis GitHub, car l'environnement de développement ne peut pas joindre la base directement. Le chargement utilise le rôle `app_ingest`, qui n'écrit que dans le schéma `ref` (données publiques).
1. Une seule fois : ajouter le secret `PREPROD_DATABASE_URL_INGEST` sur https://github.com/lucas3004-sudo/lucas/settings/secrets/actions/new. La valeur est l'adresse de connexion du rôle `app_ingest`, par le répartiteur en mode session (port 5432), en connexion chiffrée.
2. Lancer « Ingestion préproduction » : https://github.com/lucas3004-sudo/lucas/actions/workflows/ingestion-preprod.yml (bouton « Run workflow »), en choisissant les données (tout, dvf, loyers, zonage) et les départements.
3. Contrôler `ref.source_runs` : une ligne par chargement (lignes lues, retenues, exclusions par règle, statut).

## 8. Paiement (Stripe, D-057)
Le code est prêt. Le paiement s'active dès que ces variables sont renseignées chez Vercel (https://vercel.com/lucasblaevoet30-7777s-projects/lucas/settings/environment-variables) :

| Variable | Valeur |
|---|---|
| `STRIPE_SECRET_KEY` | Clé secrète **de test** (`sk_test_…`) d'abord, puis la clé réelle après validation |
| `STRIPE_WEBHOOK_SECRET` | Secret du point de réception (`whsec_…`) |

- **Prix** : un prix mensuel par formule, retrouvé par sa clé `immopilot_<formule>_mensuel` (investisseur, solo, pro, agency). Ils se créent une fois, avec l'API Stripe ou dans le tableau de bord.
- **Point de réception** : `https://<adresse du site>/api/v1/stripe/webhook`, avec les événements `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` et `customer.subscription.deleted`.
- **Fonctionnement** :
  - une agence a 14 jours d'essai à partir de sa création ;
  - si le gérant choisit une formule pendant l'essai, sa carte n'est débitée qu'à la fin de l'essai ;
  - après l'essai, sans abonnement payé, l'accès au logiciel est redirigé vers `/abonnement`, et les données sont conservées ;
  - en cas de paiement en échec, l'accès est maintenu 7 jours.
- **Écriture des abonnements** : seule la fonction `app.apply_subscription` peut les enregistrer, et le site ne l'appelle qu'après avoir vérifié la signature Stripe.
