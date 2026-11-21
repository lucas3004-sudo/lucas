-- Suivi des mandats (F5) : numéro, date de signature et date de fin, pour prévenir avant
-- l'échéance. Ce n'est PAS le registre des mandats prévu par la loi Hoguet (question n° 10 de la
-- fiche juridique) : l'agence garde son registre officiel.
-- Les droits de modification sont ceux du bien (politiques de la migration 0007).

ALTER TABLE app.properties
  ADD COLUMN mandate_number    text CHECK (length(mandate_number) BETWEEN 1 AND 30),
  ADD COLUMN mandate_signed_on date,
  ADD COLUMN mandate_ends_on   date,
  ADD CONSTRAINT properties_mandate_dates_chk
    CHECK (mandate_ends_on IS NULL OR mandate_signed_on IS NULL OR mandate_ends_on > mandate_signed_on);

-- Un numéro de mandat ne sert qu'une fois dans une agence (la numérotation est celle de l'agence).
CREATE UNIQUE INDEX properties_mandate_number_uq ON app.properties (org_id, mandate_number) WHERE mandate_number IS NOT NULL;
