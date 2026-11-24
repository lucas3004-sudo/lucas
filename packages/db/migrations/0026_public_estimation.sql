-- Page publique « Estimez votre bien » (D-067) : chaque agence peut ouvrir une page, à mettre sur
-- son site ou ses réseaux, où un propriétaire obtient une estimation indicative (ventes DVF) et
-- demande à être recontacté, avec son consentement. La demande arrive dans le CRM de l'agence :
-- contact « vendeur », consentement prouvé, bien « prospect », tâche de rappel.
--
-- Le visiteur n'a pas de compte : seules deux fonctions SECURITY DEFINER lui sont ouvertes, et
-- elles ne font que vérifier que la page est ouverte, limiter les envois et créer la demande.

CREATE TABLE app.agency_public_pages (
  org_id             uuid PRIMARY KEY REFERENCES iam.organization (id) ON DELETE CASCADE,
  estimation_enabled boolean NOT NULL DEFAULT false,
  -- Membre qui reçoit les demandes (responsable du contact, du bien et de la tâche).
  lead_owner_user_id uuid NOT NULL,
  updated_by         uuid NOT NULL,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.agency_public_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.agency_public_pages FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.agency_public_pages AS RESTRICTIVE FOR ALL TO app_user
  USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
  WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);
CREATE POLICY public_pages_read ON app.agency_public_pages FOR SELECT TO app_user USING (true);
CREATE POLICY public_pages_insert ON app.agency_public_pages FOR INSERT TO app_user
  WITH CHECK ((SELECT app.ctx_role()) IN ('gerant', 'manager') AND agency_public_pages.updated_by = (SELECT app.ctx_user())
    AND app.is_member(agency_public_pages.lead_owner_user_id));
CREATE POLICY public_pages_update ON app.agency_public_pages FOR UPDATE TO app_user
  USING ((SELECT app.ctx_role()) IN ('gerant', 'manager'))
  WITH CHECK ((SELECT app.ctx_role()) IN ('gerant', 'manager') AND agency_public_pages.updated_by = (SELECT app.ctx_user())
    AND app.is_member(agency_public_pages.lead_owner_user_id));
CREATE POLICY public_pages_operator ON app.agency_public_pages FOR ALL TO app_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON app.agency_public_pages TO app_user;

-- Envois de la page publique, pour limiter les abus (empreinte de l'adresse IP, jamais l'adresse
-- elle-même). Aucun accès direct du site : seule la fonction app.capture_public_lead écrit ici.
CREATE TABLE app.public_lead_attempts (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id     uuid NOT NULL REFERENCES iam.organization (id) ON DELETE CASCADE,
  ip_hash    text NOT NULL CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX public_lead_attempts_ip_idx ON app.public_lead_attempts (ip_hash, created_at);
CREATE INDEX public_lead_attempts_org_idx ON app.public_lead_attempts (org_id, created_at);

ALTER TABLE app.public_lead_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.public_lead_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.public_lead_attempts AS RESTRICTIVE FOR ALL TO app_user
  USING      (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL)
  WITH CHECK (org_id = (SELECT app.ctx_org()) AND (SELECT app.ctx_role()) IS NOT NULL);
CREATE POLICY public_lead_attempts_operator ON app.public_lead_attempts FOR ALL TO app_owner USING (true) WITH CHECK (true);

-- Agence dont la page d'estimation est ouverte, retrouvée par son identifiant public (slug).
CREATE FUNCTION app.public_estimation_page(p_slug text)
  RETURNS TABLE (org_id uuid, name text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app, iam AS
$$
  SELECT o.id, o.name
  FROM iam.organization o
  JOIN app.agency_public_pages p ON p.org_id = o.id AND p.estimation_enabled
  WHERE o.slug = p_slug
$$;
REVOKE ALL ON FUNCTION app.public_estimation_page(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.public_estimation_page(text) TO app_user;

-- La fonction ci-dessous s'exécute avec le rôle propriétaire, soumis lui aussi à la RLS (FORCE) :
-- il ne peut créer que des lignes marquées comme venant de la page publique, rien d'autre.
CREATE POLICY public_lead_owner_insert ON app.contacts FOR INSERT TO app_owner
  WITH CHECK (contacts.source = 'Estimation en ligne' AND 'vendeur' = ANY (contacts.roles));
CREATE POLICY public_lead_owner_insert ON app.contact_consents FOR INSERT TO app_owner
  WITH CHECK (contact_consents.status = 'accorde' AND contact_consents.proof LIKE 'Case cochée sur la page publique%');
CREATE POLICY public_lead_owner_insert ON app.properties FOR INSERT TO app_owner
  WITH CHECK (properties.status = 'prospect' AND properties.notes LIKE 'Estimation en ligne%');
CREATE POLICY public_lead_owner_insert ON app.tasks FOR INSERT TO app_owner
  WITH CHECK (tasks.title LIKE 'Rappeler %demande d''estimation en ligne');

-- Demande d'un propriétaire : vérifie la page et les limites, puis crée contact, consentements,
-- bien « prospect » et tâche de rappel pour le membre désigné. Renvoie l'identifiant du contact.
-- Limites : 3 demandes par heure et par adresse IP, 50 par jour et par agence.
CREATE FUNCTION app.capture_public_lead(
  p_org uuid, p_ip_hash text,
  p_first_name text, p_last_name text, p_email text, p_phone text, p_channels text[],
  p_address_label text, p_ban_id text, p_insee text, p_longitude double precision, p_latitude double precision,
  p_type text, p_surface numeric, p_rooms integer, p_estimate_low bigint, p_estimate_high bigint
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app, iam AS
$$
DECLARE
  owner_id uuid;
  -- Identifiants choisis ici : la fonction (rôle propriétaire) ne relit pas les lignes qu'elle crée.
  contact_id uuid := gen_random_uuid();
  property_id uuid := gen_random_uuid();
  ch text;
  proof text;
BEGIN
  SELECT p.lead_owner_user_id INTO owner_id FROM app.agency_public_pages p WHERE p.org_id = p_org AND p.estimation_enabled;
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'page fermée' USING ERRCODE = 'P0002';
  END IF;
  -- Le destinataire doit toujours être membre (il a pu quitter l'agence) : sinon le gérant.
  IF NOT EXISTS (SELECT 1 FROM iam.member m WHERE m."organizationId" = p_org AND m."userId" = owner_id) THEN
    SELECT m."userId" INTO owner_id FROM iam.member m WHERE m."organizationId" = p_org AND m.role = 'gerant' ORDER BY m."createdAt" LIMIT 1;
  END IF;
  IF (SELECT count(*) FROM app.public_lead_attempts a WHERE a.ip_hash = p_ip_hash AND a.created_at > now() - interval '1 hour') >= 3
     OR (SELECT count(*) FROM app.public_lead_attempts a WHERE a.org_id = p_org AND a.created_at > now() - interval '1 day') >= 50 THEN
    RAISE EXCEPTION 'trop de demandes' USING ERRCODE = 'P0003';
  END IF;
  IF p_channels IS NULL OR cardinality(p_channels) = 0 OR NOT p_channels <@ ARRAY['email', 'telephone'] THEN
    RAISE EXCEPTION 'consentement manquant' USING ERRCODE = '23514';
  END IF;
  INSERT INTO app.public_lead_attempts (org_id, ip_hash) VALUES (p_org, p_ip_hash);

  INSERT INTO app.contacts (id, org_id, owner_user_id, visibility, roles, first_name, last_name, email, phone, email_norm, phone_norm, source, notes, created_by)
  VALUES (contact_id, p_org, owner_id, 'agency', ARRAY['vendeur'], nullif(p_first_name, ''), p_last_name, nullif(p_email, ''), nullif(p_phone, ''),
          nullif(lower(p_email), ''), nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
          'Estimation en ligne', 'Demande reçue par la page publique « Estimez votre bien ».', owner_id);

  proof := 'Case cochée sur la page publique « Estimez votre bien » de l''agence, le ' || to_char(now() AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY à HH24:MI');
  FOREACH ch IN ARRAY p_channels LOOP
    INSERT INTO app.contact_consents (org_id, contact_id, channel, status, obtained_at, proof, recorded_by)
    VALUES (p_org, contact_id, ch, 'accorde', (now() AT TIME ZONE 'Europe/Paris')::date, proof, owner_id);
  END LOOP;

  INSERT INTO app.properties (id, org_id, owner_user_id, visibility, status, type, address_label, ban_id, insee_code, longitude, latitude, surface, rooms, seller_contact_id, notes, created_by)
  VALUES (property_id, p_org, owner_id, 'agency', 'prospect', p_type, p_address_label, p_ban_id, p_insee, p_longitude, p_latitude, p_surface, p_rooms, contact_id,
          CASE WHEN p_estimate_low IS NOT NULL AND p_estimate_high IS NOT NULL
               THEN 'Estimation en ligne montrée au propriétaire : entre ' || p_estimate_low || ' € et ' || p_estimate_high || ' € (ventes DVF, indicatif).'
               ELSE 'Estimation en ligne : pas assez de ventes comparables, aucune fourchette montrée.' END,
          owner_id);

  INSERT INTO app.tasks (org_id, assignee_user_id, created_by, title, details, due_on, contact_id, property_id)
  VALUES (p_org, owner_id, owner_id, left('Rappeler ' || coalesce(nullif(p_first_name, '') || ' ', '') || p_last_name || ' : demande d''estimation en ligne', 200),
          'Un propriétaire a demandé à être recontacté depuis la page « Estimez votre bien » : ' || p_address_label || '.',
          (now() AT TIME ZONE 'Europe/Paris')::date, contact_id, property_id);
  RETURN contact_id;
END
$$;
REVOKE ALL ON FUNCTION app.capture_public_lead(uuid, text, text, text, text, text, text[], text, text, text, double precision, double precision, text, numeric, integer, bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.capture_public_lead(uuid, text, text, text, text, text, text[], text, text, text, double precision, double precision, text, numeric, integer, bigint, bigint) TO app_user;
