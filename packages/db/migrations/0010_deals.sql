-- Affaires (critère F12, version légère) : de l'offre acceptée à l'acte authentique.
-- Visibilité : une affaire suit son BIEN (lisible si le bien l'est, sous RLS).
-- Écriture : le négociateur en charge, ou le gérant, un manager, un assistant.
-- Les colonnes de la table sont qualifiées dans les sous-requêtes (leçon de la migration 0008).

CREATE TABLE app.deals (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  property_id            uuid NOT NULL REFERENCES app.properties (id) ON DELETE CASCADE,
  owner_user_id          uuid NOT NULL,
  buyer_contact_id       uuid REFERENCES app.contacts (id) ON DELETE SET NULL,
  seller_contact_id      uuid REFERENCES app.contacts (id) ON DELETE SET NULL,
  stage                  text NOT NULL DEFAULT 'offre' CHECK (stage IN ('offre', 'compromis', 'conditions_levees', 'acte', 'abandon')),
  price                  bigint CHECK (price > 0),
  fees                   bigint CHECK (fees >= 0),
  offer_accepted_on      date,
  compromis_signed_on    date,
  retraction_notified_on date,
  loan_deadline          date,
  deed_planned_on        date,
  deed_signed_on         date,
  notary                 text CHECK (length(notary) <= 200),
  notes                  text CHECK (length(notes) <= 5000),
  checklist              jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(checklist) = 'object'),
  created_by             uuid NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deals_org_stage_idx ON app.deals (org_id, stage);
CREATE INDEX deals_property_idx ON app.deals (property_id);

ALTER TABLE app.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.deals FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.deals AS RESTRICTIVE FOR ALL TO app_user
  USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
  WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);

CREATE POLICY deals_read ON app.deals FOR SELECT TO app_user
  USING (EXISTS (SELECT 1 FROM app.properties p WHERE p.id = deals.property_id));
CREATE POLICY deals_insert ON app.deals FOR INSERT TO app_user
  WITH CHECK (deals.created_by = (SELECT app.ctx_user())
    AND ((SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant')
         OR ((SELECT app.ctx_role()) = 'negociateur' AND deals.owner_user_id = (SELECT app.ctx_user())))
    AND app.is_member(deals.owner_user_id)
    AND EXISTS (SELECT 1 FROM app.properties p WHERE p.id = deals.property_id));
CREATE POLICY deals_update ON app.deals FOR UPDATE TO app_user
  USING (deals.owner_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant'))
  WITH CHECK (app.is_member(deals.owner_user_id)
    AND (deals.owner_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant')));
CREATE POLICY deals_delete ON app.deals FOR DELETE TO app_user
  USING ((SELECT app.ctx_role()) IN ('gerant', 'manager'));

GRANT SELECT, INSERT, UPDATE, DELETE ON app.deals TO app_user;
