-- Correctif de la migration 0007 (trouvé par le test d'intégration « réattribution »).
-- Dans une sous-requête de politique, un nom de colonne non qualifié désigne d'abord la table
-- de la sous-requête : « c.owner_user_id = owner_user_id » comparait app.contacts à elle-même
-- et était donc toujours vrai. Un profil pouvait ainsi être rattaché à un autre responsable
-- que celui de son contact. Les colonnes du profil sont désormais qualifiées (buyer_profiles.*).

DROP POLICY profiles_insert ON app.buyer_profiles;
DROP POLICY profiles_update ON app.buyer_profiles;

CREATE POLICY profiles_insert ON app.buyer_profiles FOR INSERT TO app_user
  WITH CHECK (buyer_profiles.created_by = (SELECT app.ctx_user()) AND EXISTS (
    SELECT 1 FROM app.contacts c
    WHERE c.id = buyer_profiles.contact_id AND c.owner_user_id = buyer_profiles.owner_user_id
      AND (c.owner_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant'))));

CREATE POLICY profiles_update ON app.buyer_profiles FOR UPDATE TO app_user
  USING (EXISTS (
    SELECT 1 FROM app.contacts c
    WHERE c.id = buyer_profiles.contact_id
      AND (c.owner_user_id = (SELECT app.ctx_user()) OR (SELECT app.ctx_role()) IN ('gerant', 'manager', 'assistant'))))
  WITH CHECK (EXISTS (
    SELECT 1 FROM app.contacts c
    WHERE c.id = buyer_profiles.contact_id AND c.owner_user_id = buyer_profiles.owner_user_id));
