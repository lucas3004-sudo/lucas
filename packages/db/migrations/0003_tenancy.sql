-- Isolation entre agences (décision D-016, prototype prototypes/rls : 12 tests sur 12).
--
-- L'application fixe, pour chaque transaction, app.org_id et app.user_id (set_config(…, true)).
-- La base vérifie elle-même l'adhésion dans auth.member et en déduit le rôle.

-- Contexte de la transaction ------------------------------------------------------------
CREATE FUNCTION app.ctx_org() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;

CREATE FUNCTION app.ctx_user() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

-- Rôle de l'utilisateur courant dans l'agence courante (NULL s'il n'en est pas membre).
-- SECURITY DEFINER : lit auth.member avec les droits du propriétaire (app_user n'a aucun
-- accès au schéma auth). search_path figé contre tout détournement.
CREATE FUNCTION app.ctx_role() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, auth AS
  $$ SELECT m.role FROM auth.member m
     WHERE m."userId" = app.ctx_user() AND m."organizationId" = app.ctx_org() $$;

REVOKE ALL ON FUNCTION app.ctx_org(), app.ctx_user(), app.ctx_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.ctx_org(), app.ctx_user(), app.ctx_role() TO app_user;

-- Paramètres de l'agence ----------------------------------------------------------------
-- Ligne créée au premier enregistrement ; tant qu'elle n'existe pas, l'application
-- utilise les valeurs par défaut.
CREATE TABLE app.organization_settings (
  org_id             uuid PRIMARY KEY REFERENCES auth.organization (id) ON DELETE CASCADE,
  default_visibility text NOT NULL DEFAULT 'agency' CHECK (default_visibility IN ('private', 'agency')),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid NOT NULL
);

ALTER TABLE app.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.organization_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.organization_settings AS RESTRICTIVE FOR ALL TO app_user
  USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
  WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);
CREATE POLICY settings_read ON app.organization_settings FOR SELECT TO app_user
  USING (true);
CREATE POLICY settings_insert ON app.organization_settings FOR INSERT TO app_user
  WITH CHECK ((SELECT app.ctx_role()) IN ('gerant', 'manager') AND updated_by = (SELECT app.ctx_user()));
CREATE POLICY settings_update ON app.organization_settings FOR UPDATE TO app_user
  USING ((SELECT app.ctx_role()) IN ('gerant', 'manager'))
  WITH CHECK ((SELECT app.ctx_role()) IN ('gerant', 'manager') AND updated_by = (SELECT app.ctx_user()));

GRANT SELECT, INSERT, UPDATE ON app.organization_settings TO app_user;

-- Journal d'audit (ajout seul) ----------------------------------------------------------
CREATE TABLE app.audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES auth.organization (id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  action        text NOT NULL,
  target_type   text,
  target_id     text,
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_org_at_idx ON app.audit_log (org_id, at DESC);

ALTER TABLE app.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.audit_log AS RESTRICTIVE FOR ALL TO app_user
  USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
  WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);
-- Lecture réservée au gérant et aux managers (permissions.md).
CREATE POLICY audit_read ON app.audit_log FOR SELECT TO app_user
  USING ((SELECT app.ctx_role()) IN ('gerant', 'manager'));
-- Tout membre peut journaliser SES propres actions, jamais au nom d'un autre.
CREATE POLICY audit_insert ON app.audit_log FOR INSERT TO app_user
  WITH CHECK (actor_user_id = (SELECT app.ctx_user()));

-- Ajout seul : aucun droit UPDATE ni DELETE.
GRANT SELECT, INSERT ON app.audit_log TO app_user;
