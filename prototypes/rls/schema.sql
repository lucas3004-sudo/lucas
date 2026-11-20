-- ImmoPilot AI — prototype d'isolation entre agences (Row-Level Security PostgreSQL)
--
-- Principe validé ici (voir docs/phase-2/architecture.md, section « Isolation ») :
--   1. L'application se connecte avec un rôle qui n'est PAS propriétaire des tables
--      et n'a pas le droit de contourner la RLS (NOBYPASSRLS).
--   2. Pour chaque transaction, l'application fixe seulement l'utilisateur et
--      l'agence courants (set_config(..., true) = valable pour la transaction).
--   3. La base VÉRIFIE elle-même que l'utilisateur est membre de cette agence et
--      en déduit son rôle : un bug applicatif qui fixerait une mauvaise agence
--      ne donne accès à rien.
--   4. Une politique RESTRICTIVE (isolation par agence) s'ajoute à des politiques
--      PERMISSIVES (visibilité selon le rôle) : même une erreur dans une règle
--      de visibilité ne peut pas ouvrir l'accès à une autre agence.

CREATE ROLE app_owner NOLOGIN;
CREATE ROLE app_user LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

CREATE SCHEMA app AUTHORIZATION app_owner;
SET ROLE app_owner;

CREATE TABLE app.organizations (
  id   uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE app.memberships (
  user_id uuid NOT NULL,
  org_id  uuid NOT NULL REFERENCES app.organizations(id),
  role    text NOT NULL CHECK (role IN ('gerant', 'manager', 'negociateur', 'assistant', 'lecture')),
  PRIMARY KEY (user_id, org_id)
);

CREATE TABLE app.contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES app.organizations(id),
  owner_user_id uuid NOT NULL,
  visibility    text NOT NULL CHECK (visibility IN ('private', 'agency')),
  full_name     text NOT NULL
);
CREATE INDEX contacts_org_idx ON app.contacts (org_id);

-- Contexte de la transaction, fixé par l'application.
CREATE FUNCTION app.ctx_org() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;
CREATE FUNCTION app.ctx_user() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

-- Rôle de l'utilisateur courant dans l'agence courante, lu dans memberships.
-- SECURITY DEFINER : lit memberships avec les droits du propriétaire ;
-- search_path fixé pour éviter tout détournement.
CREATE FUNCTION app.ctx_role() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS
  $$ SELECT m.role FROM app.memberships m
     WHERE m.user_id = app.ctx_user() AND m.org_id = app.ctx_org() $$;

ALTER TABLE app.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE app.memberships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.memberships   FORCE ROW LEVEL SECURITY;
ALTER TABLE app.contacts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.contacts      FORCE ROW LEVEL SECURITY;

-- (SELECT …) autour des fonctions : évaluées une fois par requête, pas par ligne.
CREATE POLICY org_self ON app.organizations FOR SELECT TO app_user
  USING (id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);

CREATE POLICY membership_same_org ON app.memberships FOR SELECT TO app_user
  USING (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);

-- Indispensable : avec FORCE ROW LEVEL SECURITY, la RLS s'applique AUSSI au propriétaire.
-- Sans cette politique, app.ctx_role() (SECURITY DEFINER, exécutée en app_owner) ne voit
-- aucune adhésion et tout le monde perd l'accès. Défaut trouvé par les tests le 2026-11-20.
CREATE POLICY definer_reads_memberships ON app.memberships FOR SELECT TO app_owner
  USING (true);

-- 1) Isolation par agence : RESTRICTIVE, s'applique à toutes les commandes.
CREATE POLICY tenant_isolation ON app.contacts AS RESTRICTIVE FOR ALL TO app_user
  USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
  WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);

-- 2) Visibilité selon le rôle : PERMISSIVES.
CREATE POLICY contacts_read ON app.contacts FOR SELECT TO app_user
  USING (visibility = 'agency'
         OR owner_user_id = (SELECT app.ctx_user())
         OR (SELECT app.ctx_role()) IN ('gerant', 'manager'));

CREATE POLICY contacts_insert ON app.contacts FOR INSERT TO app_user
  WITH CHECK ((SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant')
              OR ((SELECT app.ctx_role()) = 'negociateur' AND owner_user_id = (SELECT app.ctx_user())));

CREATE POLICY contacts_update ON app.contacts FOR UPDATE TO app_user
  USING      (owner_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager'))
  WITH CHECK (owner_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager'));

CREATE POLICY contacts_delete ON app.contacts FOR DELETE TO app_user
  USING ((SELECT app.ctx_role()) IN ('gerant', 'manager'));

RESET ROLE;

GRANT USAGE ON SCHEMA app TO app_user;
GRANT SELECT ON app.organizations, app.memberships TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.contacts TO app_user;
GRANT EXECUTE ON FUNCTION app.ctx_org(), app.ctx_user(), app.ctx_role() TO app_user;

-- Données de test : agence A (gérant GA, négociateurs A1 et A2), agence B (négociateur B1).
INSERT INTO app.organizations VALUES
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Agence A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Agence B');
INSERT INTO app.memberships VALUES
  ('00000000-0000-0000-0000-0000000000a0', 'aaaaaaaa-0000-0000-0000-000000000000', 'gerant'),
  ('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'negociateur'),
  ('00000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'negociateur'),
  ('00000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'negociateur');
INSERT INTO app.contacts (org_id, owner_user_id, visibility, full_name) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1', 'private', 'A1 privé'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1', 'agency',  'A1 agence'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a2', 'private', 'A2 privé'),
  ('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b1', 'agency',  'B1 agence');

-- Volume pour la mesure de performance : 200 000 contacts répartis sur 2 agences.
INSERT INTO app.contacts (org_id, owner_user_id, visibility, full_name)
SELECT CASE WHEN g % 2 = 0 THEN 'aaaaaaaa-0000-0000-0000-000000000000'::uuid
            ELSE 'bbbbbbbb-0000-0000-0000-000000000000'::uuid END,
       CASE WHEN g % 2 = 0 THEN '00000000-0000-0000-0000-0000000000a1'::uuid
            ELSE '00000000-0000-0000-0000-0000000000b1'::uuid END,
       'agency', 'contact ' || g
FROM generate_series(1, 200000) g;
ANALYZE app.contacts;
