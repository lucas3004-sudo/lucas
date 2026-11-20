-- Données publiques partagées (schéma ref) : docs/phase-2/modele-donnees.md, section 3.5.
-- Pas de RLS : ces données sont publiques et identiques pour toutes les agences.
-- Écriture : app_ingest (droits par défaut, migration 0001). Lecture : app_user.
-- PostGIS est dans le schéma « extensions » : les types et fonctions sont qualifiés.

-- Traçabilité de chaque ingestion (fraîcheur affichée dans l'interface).
CREATE TABLE ref.source_runs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source      text NOT NULL,
  scope       text NOT NULL DEFAULT '',
  millesime   text,
  urls        text[] NOT NULL DEFAULT '{}',
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status      text NOT NULL DEFAULT 'en_cours' CHECK (status IN ('en_cours', 'reussie', 'echouee')),
  lines_read  integer,
  rows_kept   integer,
  exclusions  jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_until  date,
  error       text
);
CREATE INDEX source_runs_source_idx ON ref.source_runs (source, scope, finished_at DESC);

-- Ventes DVF NETTOYÉES (règles R1 à R5, décision D-017). Une ligne = une vente d'un logement.
CREATE TABLE ref.dvf_sales (
  mutation_id    text PRIMARY KEY,
  sale_date      date NOT NULL,
  nature         text NOT NULL CHECK (nature IN ('ancien', 'neuf')),
  dwelling_type  text NOT NULL CHECK (dwelling_type IN ('Appartement', 'Maison')),
  insee_code     text NOT NULL,
  department     text NOT NULL,
  price          numeric(14, 2) NOT NULL CHECK (price > 0),
  surface        numeric(10, 2) NOT NULL CHECK (surface >= 9),
  rooms          smallint,
  land_surface   numeric(12, 2) NOT NULL DEFAULT 0,
  price_per_sqm  numeric(10, 2) NOT NULL,
  geom           extensions.geometry(Point, 4326),
  source_run_id  bigint NOT NULL REFERENCES ref.source_runs (id)
);
CREATE INDEX dvf_sales_geog_idx ON ref.dvf_sales USING gist ((geom::extensions.geography));
CREATE INDEX dvf_sales_lookup_idx ON ref.dvf_sales (dwelling_type, nature, sale_date);
CREATE INDEX dvf_sales_department_idx ON ref.dvf_sales (department);

-- Loyers d'annonce ANIL (charges comprises, non meublé) : décision D-012.
CREATE TABLE ref.rents (
  insee_code    text NOT NULL,
  segment       text NOT NULL CHECK (segment IN ('appartement', 'appartement_t1_t2', 'appartement_t3_plus', 'maison')),
  millesime     integer NOT NULL,
  rent_per_sqm  numeric(8, 2) NOT NULL,
  low           numeric(8, 2) NOT NULL,
  high          numeric(8, 2) NOT NULL,
  prediction    text NOT NULL,
  obs_commune   integer,
  obs_maille    integer,
  r2_adj        numeric(6, 4),
  source_run_id bigint NOT NULL REFERENCES ref.source_runs (id),
  PRIMARY KEY (insee_code, segment, millesime)
);

-- Zonage ABC (tension du marché).
CREATE TABLE ref.zonage_abc (
  insee_code    text PRIMARY KEY,
  commune       text NOT NULL,
  zone          text NOT NULL,
  in_force_from date,
  source_run_id bigint NOT NULL REFERENCES ref.source_runs (id)
);

-- Caches des sources interrogées à la demande (écrits par l'application : app_user).
CREATE TABLE ref.dpe_cache (
  ban_id     text PRIMARY KEY,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  payload    jsonb NOT NULL
);
CREATE TABLE ref.risks_cache (
  cache_key  text PRIMARY KEY,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  payload    jsonb NOT NULL
);
GRANT INSERT, UPDATE ON ref.dpe_cache, ref.risks_cache TO app_user;
GRANT USAGE ON SEQUENCE ref.source_runs_id_seq TO app_ingest;
