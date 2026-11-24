-- Diffusion des annonces (D-066) : sur quels portails un bien est publié (SeLoger, Leboncoin,
-- Bien'ici…), depuis quand, avec le lien de l'annonce, et quand il a été retiré. Chaque portail
-- reste payé par l'agence avec son propre abonnement ; ImmoPilot suit la diffusion et rappelle de
-- retirer les annonces d'un bien vendu ou retiré.

CREATE TABLE app.property_portals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  property_id  uuid NOT NULL REFERENCES app.properties (id) ON DELETE CASCADE,
  portal       text NOT NULL CHECK (portal IN ('seloger', 'leboncoin', 'bienici', 'logicimmo', 'site_agence', 'autre')),
  status       text NOT NULL DEFAULT 'publie' CHECK (status IN ('publie', 'retire')),
  url          text CHECK (url ~ '^https://[^\s]+$' AND length(url) <= 500),
  published_on date NOT NULL,
  removed_on   date,
  updated_by   uuid NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, portal),
  CONSTRAINT property_portals_removed CHECK ((status = 'retire') = (removed_on IS NOT NULL) AND (removed_on IS NULL OR removed_on >= published_on))
);

ALTER TABLE app.property_portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.property_portals FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.property_portals AS RESTRICTIVE FOR ALL TO app_user
  USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
  WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);

-- Lecture : si le bien est visible. Écriture : si l'on peut modifier le bien (comme ses photos).
CREATE POLICY portals_read ON app.property_portals FOR SELECT TO app_user
  USING (EXISTS (SELECT 1 FROM app.properties p WHERE p.id = property_portals.property_id));
CREATE POLICY portals_insert ON app.property_portals FOR INSERT TO app_user
  WITH CHECK (property_portals.updated_by = (SELECT app.ctx_user()) AND EXISTS (
    SELECT 1 FROM app.properties p WHERE p.id = property_portals.property_id
      AND (p.owner_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant'))));
CREATE POLICY portals_update ON app.property_portals FOR UPDATE TO app_user
  USING (EXISTS (
    SELECT 1 FROM app.properties p WHERE p.id = property_portals.property_id
      AND (p.owner_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant'))))
  WITH CHECK (property_portals.updated_by = (SELECT app.ctx_user()));
CREATE POLICY portals_delete ON app.property_portals FOR DELETE TO app_user
  USING (EXISTS (
    SELECT 1 FROM app.properties p WHERE p.id = property_portals.property_id
      AND (p.owner_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant'))));
CREATE POLICY portals_operator ON app.property_portals FOR ALL TO app_owner USING (true) WITH CHECK (true);

-- Le bien ne change pas de portail : property_id et portal ne sont pas modifiables.
GRANT SELECT, INSERT, DELETE ON app.property_portals TO app_user;
GRANT UPDATE (status, url, published_on, removed_on, updated_by, updated_at) ON app.property_portals TO app_user;
