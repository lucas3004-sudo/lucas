-- Formule de chaque agence (D-014, D-048). Lue par les membres, JAMAIS modifiable par une agence :
-- seul l'exploitant (rôle propriétaire) change une formule, après paiement (le paiement n'est pas
-- encore branché). Sans ligne, l'agence est en « essai ».
CREATE TABLE app.agency_plans (
  org_id      uuid PRIMARY KEY REFERENCES iam.organization (id) ON DELETE CASCADE,
  plan        text NOT NULL CHECK (plan IN ('essai', 'investisseur', 'solo', 'pro', 'agency')),
  extra_seats integer NOT NULL DEFAULT 0 CHECK (extra_seats BETWEEN 0 AND 100),
  note        text CHECK (length(note) <= 300),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.agency_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.agency_plans FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.agency_plans AS RESTRICTIVE FOR ALL TO app_user
  USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
  WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);
CREATE POLICY agency_plans_read ON app.agency_plans FOR SELECT TO app_user USING (true);
-- L'exploitant (rôle propriétaire, jamais utilisé par le site : D-027) attribue les formules.
CREATE POLICY agency_plans_operator ON app.agency_plans FOR ALL TO app_owner USING (true) WITH CHECK (true);

-- Lecture seule pour l'application : aucun droit d'écriture.
GRANT SELECT ON app.agency_plans TO app_user;
