-- Historique de chaque bien (D-061) : création, changements de prix, de statut et de mandat.
-- Écrit uniquement par un déclencheur de la base (le site ne peut ni l'inventer, ni le modifier,
-- ni l'effacer) ; lisible par ceux qui voient le bien, avec la même visibilité que app.properties.

CREATE TABLE app.property_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  property_id   uuid NOT NULL REFERENCES app.properties (id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('cree', 'prix', 'statut', 'mandat')),
  old_value     text CHECK (length(old_value) <= 40),
  new_value     text CHECK (length(new_value) <= 40),
  actor_user_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX property_events_property_idx ON app.property_events (property_id, created_at);

ALTER TABLE app.property_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.property_events FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.property_events AS RESTRICTIVE FOR ALL TO app_user
  USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
  WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);
-- Même visibilité que le bien : la sous-requête passe elle-même par la RLS de app.properties.
CREATE POLICY property_events_read ON app.property_events FOR SELECT TO app_user
  USING (EXISTS (SELECT 1 FROM app.properties p WHERE p.id = property_events.property_id));
CREATE POLICY property_events_operator ON app.property_events FOR ALL TO app_owner USING (true) WITH CHECK (true);

GRANT SELECT ON app.property_events TO app_user;

CREATE FUNCTION app.log_property_event() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app AS
$$
DECLARE
  actor uuid := app.ctx_user();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO app.property_events (org_id, property_id, kind, new_value, actor_user_id)
    VALUES (NEW.org_id, NEW.id, 'cree', NEW.price::text, actor);
    RETURN NULL;
  END IF;
  IF NEW.price IS DISTINCT FROM OLD.price THEN
    INSERT INTO app.property_events (org_id, property_id, kind, old_value, new_value, actor_user_id)
    VALUES (NEW.org_id, NEW.id, 'prix', OLD.price::text, NEW.price::text, actor);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO app.property_events (org_id, property_id, kind, old_value, new_value, actor_user_id)
    VALUES (NEW.org_id, NEW.id, 'statut', OLD.status, NEW.status, actor);
  END IF;
  IF NEW.mandate_type IS DISTINCT FROM OLD.mandate_type OR NEW.mandate_ends_on IS DISTINCT FROM OLD.mandate_ends_on THEN
    INSERT INTO app.property_events (org_id, property_id, kind, old_value, new_value, actor_user_id)
    VALUES (NEW.org_id, NEW.id, 'mandat', OLD.mandate_type, NEW.mandate_type, actor);
  END IF;
  RETURN NULL;
END
$$;
REVOKE ALL ON FUNCTION app.log_property_event() FROM PUBLIC;

CREATE TRIGGER properties_history
  AFTER INSERT OR UPDATE OF price, status, mandate_type, mandate_ends_on ON app.properties
  FOR EACH ROW EXECUTE FUNCTION app.log_property_event();

-- Biens déjà saisis : un événement de création à leur date réelle (l'historique commence là).
INSERT INTO app.property_events (org_id, property_id, kind, new_value, created_at)
SELECT p.org_id, p.id, 'cree', p.price::text, p.created_at FROM app.properties p;
