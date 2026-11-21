-- Fiche annonce (contrôle des mentions obligatoires, fiche juridique 1.1) : champs complémentaires
-- du bien. Aucun changement de droits : la RLS des biens (migration 0007) s'applique.

ALTER TABLE app.properties
  ADD COLUMN ges_class            text CHECK (ges_class IN ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  ADD COLUMN energy_cost_low      integer CHECK (energy_cost_low >= 0),
  ADD COLUMN energy_cost_high     integer CHECK (energy_cost_high >= 0),
  ADD COLUMN energy_cost_year     smallint CHECK (energy_cost_year BETWEEN 2015 AND 2100),
  ADD COLUMN is_copro             boolean,
  ADD COLUMN copro_lots           integer CHECK (copro_lots > 0),
  ADD COLUMN copro_annual_charges integer CHECK (copro_annual_charges >= 0),
  ADD COLUMN copro_procedure      text CHECK (length(copro_procedure) <= 500),
  ADD COLUMN fees_payer           text CHECK (fees_payer IN ('vendeur', 'acquereur')),
  ADD COLUMN fees_percent         numeric(5, 2) CHECK (fees_percent >= 0 AND fees_percent <= 30),
  ADD COLUMN listing_title        text CHECK (length(listing_title) <= 120),
  ADD COLUMN listing_description  text CHECK (length(listing_description) <= 4000),
  ADD CONSTRAINT properties_energy_cost_range CHECK (energy_cost_low IS NULL OR energy_cost_high IS NULL OR energy_cost_low <= energy_cost_high);

-- Barème des honoraires de l'agence (lien à citer dans les annonces).
ALTER TABLE app.organization_settings ADD COLUMN fee_schedule_url text CHECK (fee_schedule_url ~ '^https://' AND length(fee_schedule_url) <= 300);
