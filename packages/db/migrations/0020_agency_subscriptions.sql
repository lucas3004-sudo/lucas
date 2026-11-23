-- Abonnement payé de chaque agence (D-057). Lu par les membres de l'agence ; JAMAIS écrit
-- directement par le site : seule la fonction app.apply_subscription (appelée par le webhook
-- Stripe, après vérification de sa signature) le met à jour, et elle aligne la formule
-- (app.agency_plans) qui fixe les quotas. Sans ligne : l'agence est en essai (14 jours).

CREATE TABLE app.agency_subscriptions (
  org_id                 uuid PRIMARY KEY REFERENCES iam.organization (id) ON DELETE CASCADE,
  status                 text NOT NULL CHECK (status IN ('actif', 'en_retard', 'annule')),
  plan                   text NOT NULL CHECK (plan IN ('investisseur', 'solo', 'pro', 'agency')),
  extra_seats            integer NOT NULL DEFAULT 0 CHECK (extra_seats BETWEEN 0 AND 100),
  stripe_customer_id     text CHECK (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  stripe_subscription_id text UNIQUE CHECK (stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  current_period_end     timestamptz,
  past_due_since         timestamptz,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.agency_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.agency_subscriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.agency_subscriptions AS RESTRICTIVE FOR ALL TO app_user
  USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
  WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);
CREATE POLICY agency_subscriptions_read ON app.agency_subscriptions FOR SELECT TO app_user USING (true);
CREATE POLICY agency_subscriptions_operator ON app.agency_subscriptions FOR ALL TO app_owner USING (true) WITH CHECK (true);

GRANT SELECT ON app.agency_subscriptions TO app_user;

-- Mise à jour depuis Stripe (seul chemin d'écriture). Idempotente : Stripe peut renvoyer un événement.
CREATE FUNCTION app.apply_subscription(
  p_org uuid, p_status text, p_plan text, p_extra_seats integer,
  p_customer text, p_subscription text, p_period_end timestamptz
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, iam AS
$$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM iam.organization o WHERE o.id = p_org) THEN
    RAISE EXCEPTION 'agence inconnue' USING ERRCODE = '23503';
  END IF;
  INSERT INTO app.agency_subscriptions AS s (org_id, status, plan, extra_seats, stripe_customer_id, stripe_subscription_id, current_period_end, past_due_since, updated_at)
  VALUES (p_org, p_status, p_plan, p_extra_seats, p_customer, p_subscription, p_period_end,
          CASE WHEN p_status = 'en_retard' THEN now() END, now())
  ON CONFLICT (org_id) DO UPDATE SET
    status = EXCLUDED.status, plan = EXCLUDED.plan, extra_seats = EXCLUDED.extra_seats,
    stripe_customer_id = coalesce(EXCLUDED.stripe_customer_id, s.stripe_customer_id),
    stripe_subscription_id = coalesce(EXCLUDED.stripe_subscription_id, s.stripe_subscription_id),
    current_period_end = EXCLUDED.current_period_end,
    past_due_since = CASE WHEN EXCLUDED.status = 'en_retard' THEN coalesce(s.past_due_since, now()) END,
    updated_at = now();
  -- La formule payée fixe les quotas ; résiliée, l'agence revient aux quotas par défaut.
  IF p_status = 'annule' THEN
    DELETE FROM app.agency_plans WHERE org_id = p_org;
  ELSE
    INSERT INTO app.agency_plans (org_id, plan, extra_seats, note) VALUES (p_org, p_plan, p_extra_seats, 'Stripe')
    ON CONFLICT (org_id) DO UPDATE SET plan = EXCLUDED.plan, extra_seats = EXCLUDED.extra_seats, note = 'Stripe', updated_at = now();
  END IF;
END
$$;
REVOKE ALL ON FUNCTION app.apply_subscription(uuid, text, text, integer, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.apply_subscription(uuid, text, text, integer, text, text, timestamptz) TO app_user;
