-- Dossiers de biens : instantanés IMMUABLES (docs/phase-2/modele-donnees.md, section 2).
-- Chaque valeur du snapshot porte sa provenance (statut, source, date). Un nouveau calcul
-- crée un nouveau dossier ; aucun dossier n'est modifié après sa création.

CREATE TABLE app.analyses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  created_by    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  kind          text NOT NULL DEFAULT 'dossier' CHECK (kind IN ('dossier')),
  address_label text NOT NULL,
  ban_id        text NOT NULL,
  insee_code    text NOT NULL,
  inputs        jsonb NOT NULL,
  snapshot      jsonb NOT NULL
);
CREATE INDEX analyses_org_created_idx ON app.analyses (org_id, created_at DESC);

ALTER TABLE app.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.analyses FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.analyses AS RESTRICTIVE FOR ALL TO app_user
  USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
  WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);
-- Toute l'agence consulte les dossiers (outil de travail commun).
CREATE POLICY analyses_read ON app.analyses FOR SELECT TO app_user USING (true);
-- Création par tout membre sauf « lecture seule », toujours en son propre nom.
CREATE POLICY analyses_insert ON app.analyses FOR INSERT TO app_user
  WITH CHECK ((SELECT app.ctx_role()) <> 'lecture' AND created_by = (SELECT app.ctx_user()));
-- Suppression par le gérant et les managers uniquement.
CREATE POLICY analyses_delete ON app.analyses FOR DELETE TO app_user
  USING ((SELECT app.ctx_role()) IN ('gerant', 'manager'));

-- Immuable : aucun droit UPDATE.
GRANT SELECT, INSERT, DELETE ON app.analyses TO app_user;
