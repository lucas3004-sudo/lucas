-- Rendez-vous (critère F4) : visites, estimations, signatures… avec export calendrier (.ics).
-- Visibilité, comme les tâches : l'organisateur, l'auteur, le gérant et les managers.
-- Un négociateur ne planifie que pour lui-même ; gérant, manager et assistant peuvent
-- planifier pour un membre de l'agence (jamais hors agence : app.is_member).

CREATE TABLE app.appointments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  organizer_user_id uuid NOT NULL,
  created_by        uuid NOT NULL,
  kind              text NOT NULL CHECK (kind IN ('visite', 'estimation', 'signature', 'rendez_vous', 'autre')),
  title             text NOT NULL CHECK (length(title) BETWEEN 2 AND 200),
  starts_at         timestamptz NOT NULL,
  ends_at           timestamptz NOT NULL,
  location          text CHECK (length(location) <= 300),
  notes             text CHECK (length(notes) <= 2000),
  status            text NOT NULL DEFAULT 'prevu' CHECK (status IN ('prevu', 'annule')),
  contact_id        uuid REFERENCES app.contacts (id) ON DELETE SET NULL,
  property_id       uuid REFERENCES app.properties (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '24 hours')
);
CREATE INDEX appointments_org_start_idx ON app.appointments (org_id, starts_at);
CREATE INDEX appointments_organizer_idx ON app.appointments (org_id, organizer_user_id, starts_at);

ALTER TABLE app.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.appointments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.appointments AS RESTRICTIVE FOR ALL TO app_user
  USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
  WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);

CREATE POLICY appointments_read ON app.appointments FOR SELECT TO app_user
  USING (appointments.organizer_user_id = (SELECT app.ctx_user()) OR appointments.created_by = (SELECT app.ctx_user())
         OR (SELECT app.ctx_role()) IN ('gerant', 'manager'));
CREATE POLICY appointments_insert ON app.appointments FOR INSERT TO app_user
  WITH CHECK (appointments.created_by = (SELECT app.ctx_user())
    AND ((SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant')
         OR ((SELECT app.ctx_role()) = 'negociateur' AND appointments.organizer_user_id = (SELECT app.ctx_user())))
    AND app.is_member(appointments.organizer_user_id));
CREATE POLICY appointments_update ON app.appointments FOR UPDATE TO app_user
  USING (appointments.organizer_user_id = (SELECT app.ctx_user()) OR appointments.created_by = (SELECT app.ctx_user())
         OR (SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant'))
  WITH CHECK (app.is_member(appointments.organizer_user_id)
    AND (appointments.organizer_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant')
         OR appointments.created_by = (SELECT app.ctx_user())));
CREATE POLICY appointments_delete ON app.appointments FOR DELETE TO app_user
  USING (appointments.created_by = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager'));

GRANT SELECT, INSERT, UPDATE, DELETE ON app.appointments TO app_user;
