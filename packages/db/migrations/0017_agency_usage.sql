-- Consommation de l'agence pour les quotas (D-048) : des NOMBRES, pour toute l'agence, y compris
-- les éléments privés que l'utilisateur ne voit pas (sans jamais les révéler).
-- La fonction s'exécute avec les droits du propriétaire ; sous FORCE RLS, ce rôle ne lit que
-- l'agence du contexte courant (politiques ci-dessous), et rien hors d'une transaction d'agence.
CREATE POLICY usage_count_owner ON app.contacts FOR SELECT TO app_owner USING (org_id = (SELECT app.ctx_org()));
CREATE POLICY usage_count_owner ON app.analyses FOR SELECT TO app_owner USING (org_id = (SELECT app.ctx_org()));

CREATE FUNCTION app.agency_usage(p_month_start timestamptz)
  RETURNS TABLE (dossiers integer, contacts integer, membres integer, invitations integer)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app, iam AS
$$
  SELECT
    (SELECT count(*)::int FROM app.analyses a WHERE a.org_id = app.ctx_org() AND a.created_at >= p_month_start),
    (SELECT count(*)::int FROM app.contacts c WHERE c.org_id = app.ctx_org()),
    (SELECT count(*)::int FROM iam.member m WHERE m."organizationId" = app.ctx_org()),
    (SELECT count(*)::int FROM iam.invitation i WHERE i."organizationId" = app.ctx_org() AND i.status = 'pending' AND i."expiresAt" > now())
  WHERE app.ctx_role() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION app.agency_usage(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.agency_usage(timestamptz) TO app_user;
