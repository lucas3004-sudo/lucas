-- Audit de sécurité du 2026-11-28 (D-073).
--
-- 1. Fonctions de contexte : chemin de recherche figé (alerte du contrôleur Supabase). Elles
--    n'ont pas de droits élevés et app_user ne peut créer d'objet dans aucun schéma : rien
--    d'exploitable, mais on ferme la porte. Les règles d'accès les appellent une fois par
--    requête (« (SELECT app.ctx_org()) »), donc aucun effet sur la vitesse.
ALTER FUNCTION app.ctx_org() SET search_path = pg_catalog;
ALTER FUNCTION app.ctx_user() SET search_path = pg_catalog;

-- 2. RGPD, minimisation : les empreintes d'adresse IP de la page « Estimez votre bien » ne
--    servent qu'à limiter les envois (3 par heure par connexion, 50 par jour par agence). Elles
--    sont effacées au bout de 2 jours, à chaque nouvel envoi.
CREATE FUNCTION app.purge_public_lead_attempts() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app AS
$$
BEGIN
  DELETE FROM app.public_lead_attempts WHERE created_at < now() - interval '2 days';
  RETURN NULL;
END
$$;
REVOKE ALL ON FUNCTION app.purge_public_lead_attempts() FROM PUBLIC;

CREATE TRIGGER public_lead_attempts_purge
  AFTER INSERT ON app.public_lead_attempts
  FOR EACH STATEMENT EXECUTE FUNCTION app.purge_public_lead_attempts();
