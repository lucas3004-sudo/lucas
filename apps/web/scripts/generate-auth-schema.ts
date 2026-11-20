/**
 * Génère le SQL des tables Better Auth à partir de la configuration réelle (options.ts),
 * en le comparant à la base pointée par DATABASE_URL_OWNER (schéma iam).
 * Le résultat est relu puis enregistré comme migration dans packages/db/migrations.
 *
 * Usage : DATABASE_URL_OWNER=… pnpm --filter @immopilot/web exec tsx scripts/generate-auth-schema.ts
 */
import { getMigrations } from "better-auth/db/migration";
import { authOptions, createAuthPool } from "../src/lib/auth/options";

const url = process.env.DATABASE_URL_OWNER;
if (!url) throw new Error("DATABASE_URL_OWNER manquant");

const pool = createAuthPool(url, true);
const { compileMigrations } = await getMigrations(authOptions(pool));
console.log(await compileMigrations());
await pool.end();
