-- ImmoPilot AI — préparation d'un serveur PostgreSQL (exécuté avec un super-utilisateur).
-- Idempotent. Les mots de passe sont passés en variables psql, jamais écrits ici :
--   psql -v owner_pw=… -v user_pw=… -v auth_pw=… -v ingest_pw=… -v dbname=… -f db-bootstrap.sql
--
-- Rôles (docs/phase-2/architecture.md, section 3 ; décision D-016) :
--   app_owner  : propriétaire des schémas et des tables, utilisé UNIQUEMENT pour les migrations
--   app_user   : connexions de l'application pour les données des agences (soumis à la RLS)
--   app_auth   : connexions de la bibliothèque d'authentification (schéma iam uniquement)
--   app_ingest : écriture des données publiques (schéma ref uniquement)
\set ON_ERROR_STOP 1

SELECT format('CREATE ROLE %I LOGIN', r) FROM unnest(ARRAY['app_owner','app_user','app_auth','app_ingest']) AS r
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) \gexec

ALTER ROLE app_owner  LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE CREATEDB PASSWORD :'owner_pw';
ALTER ROLE app_user   LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB PASSWORD :'user_pw';
ALTER ROLE app_auth   LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB PASSWORD :'auth_pw';
ALTER ROLE app_ingest LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB PASSWORD :'ingest_pw';

SELECT format('CREATE DATABASE %I OWNER app_owner', :'dbname')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'dbname') \gexec

-- Chemin de recherche de la bibliothèque d'authentification (indépendant du répartiteur de connexions).
SELECT format('ALTER ROLE app_auth IN DATABASE %I SET search_path = iam', :'dbname') \gexec

\connect :dbname
-- PostGIS dans un schéma dédié « extensions », comme sur Supabase : bases locales et distantes identiques.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO app_owner, app_user, app_ingest;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE :"dbname" TO app_user, app_auth, app_ingest;
