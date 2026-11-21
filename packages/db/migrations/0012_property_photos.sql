-- Photos des biens. Stockées en base (bytea) : elles héritent directement de l'isolation par
-- agence et de la visibilité du bien (RLS), sans service de stockage ni clé supplémentaire (D-042).
-- Contrôles côté serveur : JPEG ou PNG uniquement, métadonnées (EXIF, GPS) retirées, 1,5 Mo au plus.

CREATE TABLE app.property_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  property_id  uuid NOT NULL REFERENCES app.properties (id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
  bytes        bytea NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 1500000),
  width        integer NOT NULL CHECK (width BETWEEN 1 AND 8000),
  height       integer NOT NULL CHECK (height BETWEEN 1 AND 8000),
  position     smallint NOT NULL DEFAULT 0,
  created_by   uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX property_photos_property_idx ON app.property_photos (property_id, position, created_at);

ALTER TABLE app.property_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.property_photos FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.property_photos AS RESTRICTIVE FOR ALL TO app_user
  USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
  WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);

-- Lecture : si le bien est visible. Ajout et suppression : si l'on peut modifier le bien.
CREATE POLICY photos_read ON app.property_photos FOR SELECT TO app_user
  USING (EXISTS (SELECT 1 FROM app.properties p WHERE p.id = property_photos.property_id));
CREATE POLICY photos_insert ON app.property_photos FOR INSERT TO app_user
  WITH CHECK (property_photos.created_by = (SELECT app.ctx_user()) AND EXISTS (
    SELECT 1 FROM app.properties p WHERE p.id = property_photos.property_id
      AND (p.owner_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant'))));
CREATE POLICY photos_delete ON app.property_photos FOR DELETE TO app_user
  USING (EXISTS (
    SELECT 1 FROM app.properties p WHERE p.id = property_photos.property_id
      AND (p.owner_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant'))));

-- Pas de modification : une photo se supprime et se remplace.
GRANT SELECT, INSERT, DELETE ON app.property_photos TO app_user;
