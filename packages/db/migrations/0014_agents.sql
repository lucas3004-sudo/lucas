-- Socle des agents (docs/phase-2/moteur-agents.md, permissions.md sections 3 à 5).
-- Une mission s'exécute avec l'identité de l'utilisateur qui la lance : la RLS de ses données s'applique.
-- Résumés et étapes : des nombres et des identifiants, jamais de données personnelles.

-- Activation d'un agent par agence (gérant seulement). Absence de ligne = agent actif.
CREATE TABLE app.agent_settings (
  org_id     uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  agent_id   text NOT NULL CHECK (agent_id ~ '^[a-z][a-z-]{1,62}$'),
  enabled    boolean NOT NULL,
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, agent_id)
);

CREATE TABLE app.missions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  agent_id       text NOT NULL,
  agent_version  text NOT NULL,
  requested_by   uuid NOT NULL,
  status         text NOT NULL DEFAULT 'en_cours' CHECK (status IN ('en_cours', 'reussie', 'echouee', 'attente_approbation', 'annulee')),
  summary        jsonb NOT NULL DEFAULT '{}'::jsonb,
  error          text CHECK (length(error) <= 500),
  steps          integer NOT NULL DEFAULT 0,
  -- Coût mesuré en micro-dollars : 0 pour un agent déterministe (aucun appel à un modèle).
  cost_micro_usd bigint NOT NULL DEFAULT 0 CHECK (cost_micro_usd >= 0),
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz
);
CREATE INDEX missions_org_agent_idx ON app.missions (org_id, agent_id, started_at DESC);

CREATE TABLE app.mission_steps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  mission_id  uuid NOT NULL REFERENCES app.missions (id) ON DELETE CASCADE,
  position    integer NOT NULL,
  tool        text NOT NULL,
  level       text NOT NULL CHECK (level IN ('L0', 'L1', 'L2', 'L3')),
  status      text NOT NULL CHECK (status IN ('ok', 'refuse', 'approbation')),
  duration_ms integer NOT NULL DEFAULT 0,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mission_steps_mission_idx ON app.mission_steps (mission_id, position);

CREATE TABLE app.approvals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  mission_id   uuid NOT NULL REFERENCES app.missions (id) ON DELETE CASCADE,
  agent_id     text NOT NULL,
  tool         text NOT NULL,
  level        text NOT NULL CHECK (level IN ('L2', 'L3')),
  title        text NOT NULL CHECK (length(title) <= 300),
  payload      jsonb NOT NULL,
  requested_by uuid NOT NULL,
  status       text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'approuvee', 'refusee', 'expiree', 'echouee')),
  decided_by   uuid,
  decided_at   timestamptz,
  result       jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '7 days'
);
CREATE INDEX approvals_org_status_idx ON app.approvals (org_id, status, created_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agent_settings', 'missions', 'mission_steps', 'approvals'] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON app.%I AS RESTRICTIVE FOR ALL TO app_user
      USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
      WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)$p$, t);
  END LOOP;
END $$;

-- Réglages : lus par tous les membres, modifiés par le gérant seulement.
CREATE POLICY agent_settings_read ON app.agent_settings FOR SELECT TO app_user USING (true);
CREATE POLICY agent_settings_write ON app.agent_settings FOR ALL TO app_user
  USING ((SELECT app.ctx_role()) = 'gerant')
  WITH CHECK ((SELECT app.ctx_role()) = 'gerant' AND agent_settings.updated_by = (SELECT app.ctx_user()));

-- Missions : visibles par leur demandeur, le gérant et les managers ; lancées par soi-même (pas en lecture seule).
CREATE POLICY missions_read ON app.missions FOR SELECT TO app_user
  USING (missions.requested_by = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager'));
CREATE POLICY missions_insert ON app.missions FOR INSERT TO app_user
  WITH CHECK (missions.requested_by = (SELECT app.ctx_user()) AND (SELECT app.ctx_role()) <> 'lecture');
CREATE POLICY missions_update ON app.missions FOR UPDATE TO app_user
  USING (missions.requested_by = (SELECT app.ctx_user()))
  WITH CHECK (missions.requested_by = (SELECT app.ctx_user()));

-- Étapes : suivent leur mission ; ajoutées seulement par le demandeur ; jamais modifiées.
CREATE POLICY steps_read ON app.mission_steps FOR SELECT TO app_user
  USING (EXISTS (SELECT 1 FROM app.missions m WHERE m.id = mission_steps.mission_id));
CREATE POLICY steps_insert ON app.mission_steps FOR INSERT TO app_user
  WITH CHECK (EXISTS (SELECT 1 FROM app.missions m WHERE m.id = mission_steps.mission_id AND m.requested_by = (SELECT app.ctx_user())));

-- Approbations : demandées par le demandeur de la mission ; décidées par le gérant, un manager,
-- ou le négociateur pour ses propres missions (matrice, section 3). Jamais au nom d'un autre.
CREATE POLICY approvals_read ON app.approvals FOR SELECT TO app_user
  USING (approvals.requested_by = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager'));
CREATE POLICY approvals_insert ON app.approvals FOR INSERT TO app_user
  WITH CHECK (approvals.requested_by = (SELECT app.ctx_user()) AND approvals.status = 'en_attente'
    AND EXISTS (SELECT 1 FROM app.missions m WHERE m.id = approvals.mission_id AND m.requested_by = (SELECT app.ctx_user())));
CREATE POLICY approvals_decide ON app.approvals FOR UPDATE TO app_user
  USING (approvals.status = 'en_attente'
    AND ((SELECT app.ctx_role()) IN ('gerant', 'manager')
         OR ((SELECT app.ctx_role()) = 'negociateur' AND approvals.requested_by = (SELECT app.ctx_user()))))
  WITH CHECK (approvals.decided_by = (SELECT app.ctx_user()));

GRANT SELECT, INSERT, UPDATE, DELETE ON app.agent_settings TO app_user;
GRANT SELECT, INSERT, UPDATE ON app.missions, app.approvals TO app_user;
GRANT SELECT, INSERT ON app.mission_steps TO app_user;
