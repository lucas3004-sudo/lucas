-- Contrôle de version au démarrage (suite de D-027) : le site lit la liste des migrations
-- appliquées pour refuser de fonctionner sur une base en retard. Noms et empreintes seulement.
GRANT USAGE ON SCHEMA ops TO app_user;
GRANT SELECT (name, applied_at) ON ops.schema_migrations TO app_user;
