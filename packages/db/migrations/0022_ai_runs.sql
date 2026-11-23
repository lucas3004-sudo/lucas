-- Appels à l'IA (D-063) : un enregistrement par appel, SANS le contenu des questions ni des
-- réponses. Sert aux quotas de chaque formule (app.agency_usage), au plafond de dépenses global
-- et au suivi des coûts. Un utilisateur n'enregistre que ses propres appels ; personne ne peut
-- modifier ni effacer un appel (sinon on pourrait remettre son quota à zéro).

CREATE TABLE app.ai_runs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  feature       text NOT NULL CHECK (feature IN ('copilot', 'annonce')),
  model         text NOT NULL CHECK (length(model) BETWEEN 1 AND 60),
  status        text NOT NULL CHECK (status IN ('ok', 'refus', 'erreur')),
  input_tokens  integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cost_microusd bigint NOT NULL DEFAULT 0 CHECK (cost_microusd >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_runs_org_created_idx ON app.ai_runs (org_id, created_at);
CREATE INDEX ai_runs_created_idx ON app.ai_runs (created_at);

ALTER TABLE app.ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.ai_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.ai_runs AS RESTRICTIVE FOR ALL TO app_user
  USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
  WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);
CREATE POLICY ai_runs_insert ON app.ai_runs FOR INSERT TO app_user
  WITH CHECK (ai_runs.user_id = (SELECT app.ctx_user()) AND (SELECT app.ctx_role()) <> 'lecture');
CREATE POLICY ai_runs_read ON app.ai_runs FOR SELECT TO app_user
  USING (ai_runs.user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager'));
CREATE POLICY ai_runs_operator ON app.ai_runs FOR ALL TO app_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT ON app.ai_runs TO app_user;

-- Consommation : ajout des appels à l'IA du mois (échanges avec l'assistant, analyses d'annonces).
DROP FUNCTION app.agency_usage(timestamptz);
CREATE FUNCTION app.agency_usage(p_month_start timestamptz)
  RETURNS TABLE (dossiers integer, contacts integer, membres integer, invitations integer, copilot integer, annonces_ia integer)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app, iam AS
$$
  SELECT
    (SELECT count(*)::int FROM app.analyses a WHERE a.org_id = app.ctx_org() AND a.created_at >= p_month_start),
    (SELECT count(*)::int FROM app.contacts c WHERE c.org_id = app.ctx_org()),
    (SELECT count(*)::int FROM iam.member m WHERE m."organizationId" = app.ctx_org()),
    (SELECT count(*)::int FROM iam.invitation i WHERE i."organizationId" = app.ctx_org() AND i.status = 'pending' AND i."expiresAt" > now()),
    (SELECT count(*)::int FROM app.ai_runs r WHERE r.org_id = app.ctx_org() AND r.feature = 'copilot' AND r.status = 'ok' AND r.created_at >= p_month_start),
    (SELECT count(*)::int FROM app.ai_runs r WHERE r.org_id = app.ctx_org() AND r.feature = 'annonce' AND r.status = 'ok' AND r.created_at >= p_month_start)
  WHERE app.ctx_role() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION app.agency_usage(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.agency_usage(timestamptz) TO app_user;

-- Plafond de dépenses global (toutes agences confondues) : répond seulement « oui / non »,
-- sans révéler le montant dépensé par la plateforme ni par les autres agences.
CREATE FUNCTION app.ai_budget_left(p_month_start timestamptz, p_budget_microusd bigint)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS
$$
  SELECT coalesce(sum(r.cost_microusd), 0) < p_budget_microusd
  FROM app.ai_runs r
  WHERE r.created_at >= p_month_start AND app.ctx_role() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION app.ai_budget_left(timestamptz, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.ai_budget_left(timestamptz, bigint) TO app_user;
