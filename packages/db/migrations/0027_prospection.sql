-- Prospection (D-072) : suivre les biens que l'agence voudrait rentrer en mandat (annonce de
-- particulier repérée, bouche-à-oreille, demande d'estimation en ligne) dans le CRM existant, sans
-- second fichier. Un bien suivi est un bien de l'agence avec :
--   - un statut de prospection (à contacter, contacté, en attente, relance à effectuer, rendez-vous
--     obtenu, mandat obtenu, sans suite) ;
--   - un favori et le lien de l'annonce d'origine.
-- Le propriétaire reste un contact « vendeur », ses accords restent des consentements, et les
-- relances sont des tâches. Plus tard, un fournisseur d'annonces sous licence (D-071) remplira cette
-- même liste.

ALTER TABLE app.properties
  ADD COLUMN prospection_status text CHECK (prospection_status IN (
    'a_contacter', 'contacte', 'en_attente', 'relance', 'rendez_vous', 'mandat_obtenu', 'sans_suite')),
  ADD COLUMN prospection_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN source_url text CHECK (length(source_url) <= 500 AND source_url ~ '^https://[^[:space:]]+$');

CREATE INDEX properties_prospection_idx ON app.properties (org_id, prospection_status) WHERE prospection_status IS NOT NULL;

-- Historique (D-061) : la base note aussi chaque changement de statut de prospection.
ALTER TABLE app.property_events DROP CONSTRAINT property_events_kind_check;
ALTER TABLE app.property_events ADD CONSTRAINT property_events_kind_check
  CHECK (kind IN ('cree', 'prix', 'statut', 'mandat', 'prospection'));

CREATE OR REPLACE FUNCTION app.log_property_event() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app AS
$$
DECLARE
  actor uuid := app.ctx_user();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO app.property_events (org_id, property_id, kind, new_value, actor_user_id)
    VALUES (NEW.org_id, NEW.id, 'cree', NEW.price::text, actor);
    IF NEW.prospection_status IS NOT NULL THEN
      INSERT INTO app.property_events (org_id, property_id, kind, new_value, actor_user_id)
      VALUES (NEW.org_id, NEW.id, 'prospection', NEW.prospection_status, actor);
    END IF;
    RETURN NULL;
  END IF;
  IF NEW.price IS DISTINCT FROM OLD.price THEN
    INSERT INTO app.property_events (org_id, property_id, kind, old_value, new_value, actor_user_id)
    VALUES (NEW.org_id, NEW.id, 'prix', OLD.price::text, NEW.price::text, actor);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO app.property_events (org_id, property_id, kind, old_value, new_value, actor_user_id)
    VALUES (NEW.org_id, NEW.id, 'statut', OLD.status, NEW.status, actor);
  END IF;
  IF NEW.mandate_type IS DISTINCT FROM OLD.mandate_type OR NEW.mandate_ends_on IS DISTINCT FROM OLD.mandate_ends_on THEN
    INSERT INTO app.property_events (org_id, property_id, kind, old_value, new_value, actor_user_id)
    VALUES (NEW.org_id, NEW.id, 'mandat', OLD.mandate_type, NEW.mandate_type, actor);
  END IF;
  IF NEW.prospection_status IS DISTINCT FROM OLD.prospection_status THEN
    INSERT INTO app.property_events (org_id, property_id, kind, old_value, new_value, actor_user_id)
    VALUES (NEW.org_id, NEW.id, 'prospection', OLD.prospection_status, NEW.prospection_status, actor);
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER properties_history ON app.properties;
CREATE TRIGGER properties_history
  AFTER INSERT OR UPDATE OF price, status, mandate_type, mandate_ends_on, prospection_status ON app.properties
  FOR EACH ROW EXECUTE FUNCTION app.log_property_event();

-- Page publique « Estimez votre bien » (D-067) : la demande d'un propriétaire arrive directement
-- dans la liste de prospection, « à contacter ». Même fonction que 0026, avec cette seule différence.
CREATE OR REPLACE FUNCTION app.capture_public_lead(
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

  INSERT INTO app.properties (id, org_id, owner_user_id, visibility, status, prospection_status, type, address_label, ban_id, insee_code, longitude, latitude, surface, rooms, seller_contact_id, notes, created_by)
  VALUES (property_id, p_org, owner_id, 'agency', 'prospect', 'a_contacter', p_type, p_address_label, p_ban_id, p_insee, p_longitude, p_latitude, p_surface, p_rooms, contact_id,
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
