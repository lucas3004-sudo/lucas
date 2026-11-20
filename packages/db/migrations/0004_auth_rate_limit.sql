-- Compteur de limitation des tentatives de Better Auth, stocké en base (options.ts : rateLimit.storage
-- = "database") pour fonctionner avec plusieurs instances. Généré par generate-auth-schema.ts.
SET LOCAL search_path TO auth;

create table "rateLimit" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "key" text not null unique, "count" integer not null, "lastRequest" bigint not null);
