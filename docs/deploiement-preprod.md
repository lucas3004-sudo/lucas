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
- Les adresses de prévisualisation de Vercel (une par modification) ne permettent pas de se connecter. Seule l'adresse de production est reconnue par l'authentification.

## 5. Répartiteur de connexions (identifié le 20/11/2026)
L'hôte du répartiteur n'est pas déductible de la référence du projet. Il a été identifié par une tentative de connexion volontairement fausse, depuis GitHub Actions (aucun secret utilisé) :
- `aws-0-eu-west-3.pooler.supabase.com` : « tenant/user not found », donc ce n'est pas le bon ;
- `aws-1-eu-west-3.pooler.supabase.com` : « password authentication failed », donc **c'est le bon**. Il reconnaît aussi les rôles `app_user` et `app_auth`.
