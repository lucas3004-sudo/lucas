-- Double authentification (Better Auth 1.7.25, extension two-factor) : application TOTP et codes de secours.
-- Généré par apps/web/scripts/generate-auth-schema.ts à partir de apps/web/src/lib/auth/options.ts, puis relu.
-- Le secret TOTP et les codes de secours sont chiffrés par la bibliothèque (BETTER_AUTH_SECRET).
-- Pas de RLS sur ce schéma : seul le rôle app_auth y accède (droits par défaut, migration 0001).
SET LOCAL search_path TO iam;

alter table "user" add column "twoFactorEnabled" boolean default false;

create table "twoFactor" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "secret" text not null, "backupCodes" text not null, "userId" uuid not null references "user" ("id") on delete cascade, "verified" boolean, "failedVerificationCount" integer, "lockedUntil" timestamptz);

create index "twoFactor_secret_idx" on "twoFactor" ("secret");

create index "twoFactor_userId_idx" on "twoFactor" ("userId");
