-- CRM de l'agence (critères F4, F5, F6) : contacts, consentements, profils d'acquéreurs, biens, tâches.
-- Visibilité (docs/phase-2/permissions.md, section 2) :
--   « private » : le responsable, le gérant et les managers ; « agency » : toute l'agence.
-- Les tables filles (consentements) suivent la visibilité du contact : la sous-requête sur
-- app.contacts est elle-même soumise à la RLS de l'utilisateur courant.
-- Les CRITÈRES des profils d'acquéreurs sont lisibles par toute l'agence pour le matching ;
-- l'IDENTITÉ de l'acquéreur reste protégée par la visibilité du contact (décision D-031).

-- Appartenance d'un utilisateur à l'agence courante (pour l'attribution des tâches).
CREATE FUNCTION app.is_member(p_user uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, iam AS
  $$ SELECT EXISTS (SELECT 1 FROM iam.member m WHERE m."userId" = p_user AND m."organizationId" = app.ctx_org()) $$;
REVOKE ALL ON FUNCTION app.is_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.is_member(uuid) TO app_user;

-- Contacts ------------------------------------------------------------------------------
CREATE TABLE app.contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  visibility    text NOT NULL CHECK (visibility IN ('private', 'agency')),
  roles         text[] NOT NULL DEFAULT '{}' CHECK (roles <@ ARRAY['acquereur', 'vendeur', 'investisseur', 'bailleur', 'locataire', 'autre']),
  first_name    text,
  last_name     text NOT NULL CHECK (length(last_name) BETWEEN 1 AND 120),
  email         text,
  phone         text,
  email_norm    text,
  phone_norm    text,
  source        text,
  notes         text CHECK (length(notes) <= 5000),
  created_by    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contacts_org_name_idx ON app.contacts (org_id, last_name, first_name);
CREATE INDEX contacts_email_idx ON app.contacts (org_id, email_norm) WHERE email_norm IS NOT NULL;
CREATE INDEX contacts_phone_idx ON app.contacts (org_id, phone_norm) WHERE phone_norm IS NOT NULL;

-- Consentements à la prospection (fiche juridique, section 1.2 : obligatoire depuis le 11/08/2026).
CREATE TABLE app.contact_consents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES app.contacts (id) ON DELETE CASCADE,
  channel     text NOT NULL CHECK (channel IN ('telephone', 'email', 'sms')),
  status      text NOT NULL CHECK (status IN ('accorde', 'retire')),
  obtained_at date NOT NULL,
  expires_at  date,
  proof       text NOT NULL CHECK (length(proof) BETWEEN 3 AND 1000),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contact_consents_contact_idx ON app.contact_consents (contact_id, channel, recorded_at DESC);

-- Profils de recherche des acquéreurs (critères uniquement, aucune note libre).
CREATE TABLE app.buyer_profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  contact_id   uuid NOT NULL REFERENCES app.contacts (id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  status       text NOT NULL DEFAULT 'actif' CHECK (status IN ('actif', 'en_pause', 'clos')),
  types        text[] NOT NULL DEFAULT '{}' CHECK (types <@ ARRAY['Appartement', 'Maison']),
  budget_max   bigint CHECK (budget_max > 0),
  surface_min  numeric(8, 2) CHECK (surface_min > 0),
  rooms_min    smallint CHECK (rooms_min > 0),
  insee_codes  text[] NOT NULL DEFAULT '{}',
  features     text[] NOT NULL DEFAULT '{}' CHECK (features <@ ARRAY['ascenseur', 'balcon_terrasse', 'jardin', 'stationnement', 'cave', 'plain_pied', 'piscine']),
  created_by   uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buyer_profiles_org_status_idx ON app.buyer_profiles (org_id, status);

-- Biens de l'agence (mandats et prospects).
CREATE TABLE app.properties (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  owner_user_id     uuid NOT NULL,
  visibility        text NOT NULL CHECK (visibility IN ('private', 'agency')),
  status            text NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'mandat', 'sous_offre', 'vendu', 'retire')),
  mandate_type      text CHECK (mandate_type IN ('simple', 'exclusif')),
  type              text NOT NULL CHECK (type IN ('Appartement', 'Maison')),
  address_label     text NOT NULL,
  ban_id            text NOT NULL,
  insee_code        text NOT NULL,
  longitude         double precision,
  latitude          double precision,
  surface           numeric(8, 2) CHECK (surface >= 9),
  rooms             smallint CHECK (rooms > 0),
  price             bigint CHECK (price > 0),
  dpe_class         text CHECK (dpe_class IN ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  features          text[] NOT NULL DEFAULT '{}' CHECK (features <@ ARRAY['ascenseur', 'balcon_terrasse', 'jardin', 'stationnement', 'cave', 'plain_pied', 'piscine']),
  seller_contact_id uuid REFERENCES app.contacts (id) ON DELETE SET NULL,
  notes             text CHECK (length(notes) <= 5000),
  created_by        uuid NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX properties_org_status_idx ON app.properties (org_id, status);

-- Tâches (relances, « prévenir un collègue »…).
CREATE TABLE app.tasks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  assignee_user_id uuid NOT NULL,
  created_by       uuid NOT NULL,
  title            text NOT NULL CHECK (length(title) BETWEEN 2 AND 200),
  details          text CHECK (length(details) <= 2000),
  due_on           date,
  status           text NOT NULL DEFAULT 'a_faire' CHECK (status IN ('a_faire', 'faite')),
  contact_id       uuid REFERENCES app.contacts (id) ON DELETE SET NULL,
  property_id      uuid REFERENCES app.properties (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  done_at          timestamptz
);
CREATE INDEX tasks_assignee_idx ON app.tasks (org_id, assignee_user_id, status, due_on);

-- RLS : isolation par agence (restrictive) sur chaque table ---------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contacts', 'contact_consents', 'buyer_profiles', 'properties', 'tasks'] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON app.%I AS RESTRICTIVE FOR ALL TO app_user
      USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
      WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)$p$, t);
  END LOOP;
END $$;

-- Contacts et biens : visibilité privé / agence.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contacts', 'properties'] LOOP
    EXECUTE format($p$CREATE POLICY %1$s_read ON app.%1$I FOR SELECT TO app_user
      USING (visibility = 'agency' OR owner_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager'))$p$, t);
    EXECUTE format($p$CREATE POLICY %1$s_insert ON app.%1$I FOR INSERT TO app_user
      WITH CHECK (created_by = (SELECT app.ctx_user())
        AND ((SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant')
             OR ((SELECT app.ctx_role()) = 'negociateur' AND owner_user_id = (SELECT app.ctx_user())))
        AND app.is_member(owner_user_id))$p$, t);
    EXECUTE format($p$CREATE POLICY %1$s_update ON app.%1$I FOR UPDATE TO app_user
      USING      (owner_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant'))
      WITH CHECK ((owner_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant'))
                  AND app.is_member(owner_user_id))$p$, t);
    EXECUTE format($p$CREATE POLICY %1$s_delete ON app.%1$I FOR DELETE TO app_user
      USING ((SELECT app.ctx_role()) IN ('gerant', 'manager'))$p$, t);
  END LOOP;
END $$;

-- Consentements : suivent le contact (lecture si le contact est visible ; écriture si on peut le modifier).
CREATE POLICY consents_read ON app.contact_consents FOR SELECT TO app_user
  USING (EXISTS (SELECT 1 FROM app.contacts c WHERE c.id = contact_id));
CREATE POLICY consents_insert ON app.contact_consents FOR INSERT TO app_user
  WITH CHECK (recorded_by = (SELECT app.ctx_user()) AND EXISTS (
    SELECT 1 FROM app.contacts c WHERE c.id = contact_id
      AND (c.owner_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant'))));
-- Pas de modification ni de suppression : un retrait de consentement est une NOUVELLE ligne (preuve conservée).

-- Profils d'acquéreurs : critères lisibles par toute l'agence (matching) ; écriture si on peut modifier le contact.
CREATE POLICY profiles_read ON app.buyer_profiles FOR SELECT TO app_user USING (true);
CREATE POLICY profiles_insert ON app.buyer_profiles FOR INSERT TO app_user
  WITH CHECK (created_by = (SELECT app.ctx_user()) AND EXISTS (
    SELECT 1 FROM app.contacts c WHERE c.id = contact_id AND c.owner_user_id = owner_user_id
      AND (c.owner_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant'))));
CREATE POLICY profiles_update ON app.buyer_profiles FOR UPDATE TO app_user
  USING (EXISTS (SELECT 1 FROM app.contacts c WHERE c.id = contact_id
      AND (c.owner_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant'))))
  WITH CHECK (EXISTS (SELECT 1 FROM app.contacts c WHERE c.id = contact_id AND c.owner_user_id = owner_user_id));
CREATE POLICY profiles_delete ON app.buyer_profiles FOR DELETE TO app_user
  USING ((SELECT app.ctx_role()) IN ('gerant', 'manager') OR owner_user_id = (SELECT app.ctx_user()));

-- Tâches : visibles par la personne assignée, leur auteur, le gérant et les managers.
CREATE POLICY tasks_read ON app.tasks FOR SELECT TO app_user
  USING (assignee_user_id = (SELECT app.ctx_user()) OR created_by = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager'));
CREATE POLICY tasks_insert ON app.tasks FOR INSERT TO app_user
  WITH CHECK (created_by = (SELECT app.ctx_user()) AND (SELECT app.ctx_role()) <> 'lecture' AND app.is_member(assignee_user_id));
CREATE POLICY tasks_update ON app.tasks FOR UPDATE TO app_user
  USING (assignee_user_id = (SELECT app.ctx_user()) OR created_by = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager'))
  WITH CHECK (app.is_member(assignee_user_id));
CREATE POLICY tasks_delete ON app.tasks FOR DELETE TO app_user
  USING (created_by = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager'));

GRANT SELECT, INSERT, UPDATE, DELETE ON app.contacts, app.buyer_profiles, app.properties, app.tasks TO app_user;
GRANT SELECT, INSERT ON app.contact_consents TO app_user;
