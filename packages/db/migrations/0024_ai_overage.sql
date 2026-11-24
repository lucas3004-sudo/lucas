-- Crédits IA à l'usage (D-065) : au-delà du quota de la formule, chaque appel réussi est facturé
-- à son prix unitaire (enregistré au moment de l'appel), dans la limite du plafond mensuel fixé
-- par le gérant. Facturation : ligne ajoutée à la facture Stripe suivante (webhook invoice.created).

-- Prix facturé pour cet appel, en centimes (0 : inclus dans la formule).
ALTER TABLE app.ai_runs ADD COLUMN overage_cents integer NOT NULL DEFAULT 0 CHECK (overage_cents BETWEEN 0 AND 100);
ALTER TABLE app.ai_runs ADD CONSTRAINT ai_runs_overage_ok CHECK (overage_cents = 0 OR status = 'ok');

-- Plafond mensuel des crédits à l'usage, choisi par le gérant (sans ligne : 30 € par défaut).
CREATE TABLE app.agency_ai_settings (
  org_id            uuid PRIMARY KEY REFERENCES iam.organization (id) ON DELETE CASCADE,
  overage_cap_cents integer NOT NULL CHECK (overage_cap_cents BETWEEN 0 AND 50000),
  updated_by        uuid NOT NULL,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.agency_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.agency_ai_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.agency_ai_settings AS RESTRICTIVE FOR ALL TO app_user
  USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
  WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);
CREATE POLICY agency_ai_settings_read ON app.agency_ai_settings FOR SELECT TO app_user USING (true);
CREATE POLICY agency_ai_settings_insert ON app.agency_ai_settings FOR INSERT TO app_user
  WITH CHECK ((SELECT app.ctx_role()) = 'gerant' AND agency_ai_settings.updated_by = (SELECT app.ctx_user()));
CREATE POLICY agency_ai_settings_update ON app.agency_ai_settings FOR UPDATE TO app_user
  USING ((SELECT app.ctx_role()) = 'gerant')
  WITH CHECK ((SELECT app.ctx_role()) = 'gerant' AND agency_ai_settings.updated_by = (SELECT app.ctx_user()));
CREATE POLICY agency_ai_settings_operator ON app.agency_ai_settings FOR ALL TO app_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON app.agency_ai_settings TO app_user;

-- Crédits consommés par toute l'agence depuis une date (chiffres seulement, aucun détail par personne).
CREATE FUNCTION app.ai_overage(p_from timestamptz)
  RETURNS TABLE (copilot integer, annonces integer, cents bigint)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS
$$
  SELECT
    count(*) FILTER (WHERE r.feature = 'copilot')::int,
    count(*) FILTER (WHERE r.feature = 'annonce')::int,
    coalesce(sum(r.overage_cents), 0)::bigint
  FROM app.ai_runs r
  WHERE r.org_id = app.ctx_org() AND app.ctx_role() IS NOT NULL
    AND r.status = 'ok' AND r.overage_cents > 0 AND r.created_at >= p_from
$$;
REVOKE ALL ON FUNCTION app.ai_overage(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.ai_overage(timestamptz) TO app_user;

-- Facturation (webhook Stripe signé, sans utilisateur) : crédits d'une période de facturation pour
-- le client Stripe d'une agence. Comme app.apply_subscription, appelée seulement par le serveur.
CREATE FUNCTION app.ai_overage_for_customer(p_customer text, p_from timestamptz, p_to timestamptz)
  RETURNS TABLE (org_id uuid, copilot integer, annonces integer, cents bigint)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS
$$
  SELECT
    s.org_id,
    count(r.id) FILTER (WHERE r.feature = 'copilot')::int,
    count(r.id) FILTER (WHERE r.feature = 'annonce')::int,
    coalesce(sum(r.overage_cents), 0)::bigint
  FROM app.agency_subscriptions s
  LEFT JOIN app.ai_runs r ON r.org_id = s.org_id AND r.status = 'ok' AND r.overage_cents > 0
    AND r.created_at >= p_from AND r.created_at < p_to
  WHERE s.stripe_customer_id = p_customer
  GROUP BY s.org_id
$$;
REVOKE ALL ON FUNCTION app.ai_overage_for_customer(text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.ai_overage_for_customer(text, timestamptz, timestamptz) TO app_user;
