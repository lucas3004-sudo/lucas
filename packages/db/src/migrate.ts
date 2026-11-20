/**
 * Applique les migrations SQL de packages/db/migrations, dans l'ordre des noms de fichier.
 *
 * - Connexion avec DATABASE_URL_OWNER (rôle app_owner, propriétaire des schémas).
 * - Chaque migration s'exécute dans sa propre transaction.
 * - Une migration déjà appliquée dont le contenu a changé bloque tout : on n'édite jamais
 *   une migration publiée, on en ajoute une nouvelle.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations", import.meta.url));

export async function migrate(connectionString: string, log: (msg: string) => void = console.log) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("CREATE SCHEMA IF NOT EXISTS ops");
    await client.query(`CREATE TABLE IF NOT EXISTS ops.schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = new Map<string, string>(
      (await client.query<{ name: string; checksum: string }>("SELECT name, checksum FROM ops.schema_migrations"))
        .rows.map((r) => [r.name, r.checksum]),
    );

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    let count = 0;
    for (const file of files) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previous = applied.get(file);
      if (previous) {
        if (previous !== checksum) {
          throw new Error(`La migration ${file} a été modifiée après application. Créez une nouvelle migration.`);
        }
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO ops.schema_migrations (name, checksum) VALUES ($1, $2)", [file, checksum]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Échec de la migration ${file} : ${(error as Error).message}`);
      }
      log(`  migration appliquée : ${file}`);
      count++;
    }
    const db = (await client.query<{ db: string }>("SELECT current_database() AS db")).rows[0]?.db;
    log(`${db} : ${count} migration(s) appliquée(s), ${files.length} au total.`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) {
    console.error("DATABASE_URL_OWNER manquant (voir .env.example).");
    process.exit(1);
  }
  migrate(url).catch((error: Error) => {
    console.error(error.message);
    process.exit(1);
  });
}
