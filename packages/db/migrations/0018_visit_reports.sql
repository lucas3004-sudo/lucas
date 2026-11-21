-- Comptes rendus de visite (F9, partie sans IA) : un par rendez-vous de type « visite ».
-- Le texte destiné au vendeur est produit par le logiciel, sans le nom de l'acquéreur.
-- Lecture : l'auteur, l'organisateur de la visite, le responsable du bien (il rend compte au
-- vendeur), le gérant et les managers. Écriture : sur une visite que l'on voit, jamais en lecture seule.

CREATE TABLE app.visit_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  appointment_id  uuid NOT NULL UNIQUE REFERENCES app.appointments (id) ON DELETE CASCADE,
  property_id     uuid REFERENCES app.properties (id) ON DELETE SET NULL,
  author_user_id  uuid NOT NULL,
  interest        text NOT NULL CHECK (interest IN ('fort', 'moyen', 'faible', 'aucun')),
  price_opinion   text CHECK (price_opinion IN ('coherent', 'eleve', 'trop_eleve', 'attractif')),
  next_step       text NOT NULL CHECK (next_step IN ('offre', 'seconde_visite', 'reflexion', 'abandon')),
  positives       text CHECK (length(positives) <= 2000),
  objections      text CHECK (length(objections) <= 2000),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX visit_reports_property_idx ON app.visit_reports (org_id, property_id, created_at);

ALTER TABLE app.visit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.visit_reports FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.visit_reports AS RESTRICTIVE FOR ALL TO app_user
  USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
  WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);

-- Colonnes de la table toujours qualifiées dans les sous-requêtes (leçon de la migration 0008).
CREATE POLICY visit_reports_read ON app.visit_reports FOR SELECT TO app_user
  USING (visit_reports.author_user_id = (SELECT app.ctx_user())
         OR (SELECT app.ctx_role()) IN ('gerant', 'manager')
         OR EXISTS (SELECT 1 FROM app.appointments a
                    WHERE a.id = visit_reports.appointment_id AND a.organizer_user_id = (SELECT app.ctx_user()))
         OR EXISTS (SELECT 1 FROM app.properties p
                    WHERE p.id = visit_reports.property_id AND p.owner_user_id = (SELECT app.ctx_user())));

-- La visite doit être visible de l'auteur (RLS des rendez-vous), de type « visite », et le bien
-- enregistré doit être celui de la visite.
CREATE POLICY visit_reports_insert ON app.visit_reports FOR INSERT TO app_user
  WITH CHECK (visit_reports.author_user_id = (SELECT app.ctx_user())
    AND (SELECT app.ctx_role()) <> 'lecture'
    AND EXISTS (SELECT 1 FROM app.appointments a
                WHERE a.id = visit_reports.appointment_id AND a.kind = 'visite'
                  AND a.property_id IS NOT DISTINCT FROM visit_reports.property_id));

CREATE POLICY visit_reports_update ON app.visit_reports FOR UPDATE TO app_user
  USING      (visit_reports.author_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager'))
  WITH CHECK (visit_reports.author_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager'));

CREATE POLICY visit_reports_delete ON app.visit_reports FOR DELETE TO app_user
  USING (visit_reports.author_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager'));

GRANT SELECT, INSERT, DELETE ON app.visit_reports TO app_user;
-- Seul le contenu se modifie : ni la visite, ni le bien, ni l'auteur.
GRANT UPDATE (interest, price_opinion, next_step, positives, objections, updated_at) ON app.visit_reports TO app_user;
