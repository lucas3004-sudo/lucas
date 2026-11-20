-- Schémas et droits de base (docs/phase-2/modele-donnees.md, section 1).
--   iam  : tables de la bibliothèque d'authentification (rôle app_auth)
--   app  : données des agences, sous RLS (rôle app_user)
--   ref  : données publiques partagées (écriture app_ingest, lecture app_user)
--   ops  : technique (migrations, files)

CREATE SCHEMA IF NOT EXISTS iam;   -- pas « auth » : nom réservé par Supabase
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS ref;
CREATE SCHEMA IF NOT EXISTS ops;

-- Aucun droit implicite.
REVOKE ALL ON SCHEMA iam, app, ref, ops FROM PUBLIC;

GRANT USAGE ON SCHEMA iam TO app_auth;
GRANT USAGE ON SCHEMA app  TO app_user;
GRANT USAGE ON SCHEMA ref  TO app_user, app_ingest;

-- Tables futures : droits par défaut sur chaque schéma (les tables créées par app_owner).
ALTER DEFAULT PRIVILEGES IN SCHEMA iam GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_auth;
ALTER DEFAULT PRIVILEGES IN SCHEMA ref  GRANT SELECT ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA ref  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_ingest;
-- Schéma app : AUCUN droit par défaut. Chaque table reçoit ses droits explicitement,
-- en même temps que sa politique RLS (voir le test « aucune table oubliée »).
