-- Passage automatique des agents (D-064) : chaque jour, à la première connexion d'un utilisateur,
-- les agents activés tournent avec SES droits (la RLS s'applique, comme pour un lancement à la
-- main). L'index unique garantit un seul passage automatique par agent, par utilisateur et par
-- jour (heure de Paris), même si plusieurs onglets s'ouvrent en même temps.

ALTER TABLE app.missions
  ADD COLUMN trigger text NOT NULL DEFAULT 'manuel' CHECK (trigger IN ('manuel', 'auto')),
  ADD COLUMN run_on  date,
  ADD CONSTRAINT missions_auto_run_on CHECK (trigger = 'manuel' OR run_on IS NOT NULL);

CREATE UNIQUE INDEX missions_auto_daily_idx ON app.missions (org_id, agent_id, requested_by, run_on) WHERE trigger = 'auto';
