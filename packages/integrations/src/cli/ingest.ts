/**
 * Ingestion des données publiques dans le schéma ref (rôle app_ingest).
 *
 *   DATABASE_URL_INGEST=… pnpm --filter @immopilot/integrations ingest dvf --departements 80,60
 *   DATABASE_URL_INGEST=… pnpm --filter @immopilot/integrations ingest loyers
 *   DATABASE_URL_INGEST=… pnpm --filter @immopilot/integrations ingest zonage
 *
 * Chaque exécution est tracée dans ref.source_runs (lignes lues, retenues, exclusions par règle).
 * DVF : le nettoyage (R1 à R5) est appliqué COMMUNE PAR COMMUNE, comme le prototype et le test
 * de référence, puis les ventes du département sont remplacées en une transaction.
 */
import { cleanDvf, type CleanSale, type DvfLine, type RuleId } from "@immopilot/domain";
import pg from "pg";
import { DVF_UNCOVERED_DEPARTMENTS, listDvfFiles, streamDvf } from "../dvf";
import { downloadRents, latestRentsDataset } from "../rents";
import { downloadZonage } from "../zonage";

const DEFAULT_DVF_FILES = 3; // ≈ 24 derniers mois disponibles (+ marge)
const BATCH = 2000;

type Client = pg.PoolClient;

async function startRun(c: Client, source: string, scope: string, millesime: string | null, urls: string[]): Promise<number> {
  const { rows } = await c.query<{ id: string }>(
    "INSERT INTO ref.source_runs (source, scope, millesime, urls) VALUES ($1, $2, $3, $4) RETURNING id",
    [source, scope, millesime, urls],
  );
  return Number(rows[0]!.id);
}

async function finishRun(c: Client, id: number, values: { lines: number; kept: number; exclusions?: object; dataUntil?: string | null }) {
  await c.query(
    `UPDATE ref.source_runs SET status = 'reussie', finished_at = now(), lines_read = $2, rows_kept = $3,
       exclusions = $4, data_until = $5 WHERE id = $1`,
    [id, values.lines, values.kept, JSON.stringify(values.exclusions ?? {}), values.dataUntil ?? null],
  );
}

async function failRun(pool: pg.Pool, source: string, scope: string, error: unknown) {
  await pool.query(
    `INSERT INTO ref.source_runs (source, scope, status, finished_at, error) VALUES ($1, $2, 'echouee', now(), $3)`,
    [source, scope, String((error as Error)?.message ?? error).slice(0, 2000)],
  );
}

async function insertSales(c: Client, sales: CleanSale[], department: string, runId: number) {
  for (let i = 0; i < sales.length; i += BATCH) {
    const batch = sales.slice(i, i + BATCH);
    await c.query(
      `INSERT INTO ref.dvf_sales (mutation_id, sale_date, nature, dwelling_type, insee_code, department, price, surface,
         rooms, land_surface, price_per_sqm, geom, source_run_id)
       SELECT m, d::date, n, t, ic, $12, p, s, r, l, ppm,
              CASE WHEN lon IS NULL OR lat IS NULL THEN NULL
                   ELSE extensions.ST_SetSRID(extensions.ST_MakePoint(lon, lat), 4326) END,
              $13
       FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::numeric[], $7::numeric[],
                   $8::smallint[], $9::numeric[], $10::numeric[], $11::float8[], $14::float8[])
            AS x(m, d, n, t, ic, p, s, r, l, ppm, lon, lat)
       ON CONFLICT (mutation_id) DO NOTHING`,
      [
        batch.map((s) => s.mutationId), batch.map((s) => s.date), batch.map((s) => s.nature), batch.map((s) => s.type),
        batch.map((s) => s.inseeCode), batch.map((s) => s.price), batch.map((s) => s.surface), batch.map((s) => s.rooms),
        batch.map((s) => s.landSurface), batch.map((s) => Math.round(s.pricePerSqm * 100) / 100),
        batch.map((s) => s.longitude), department, runId, batch.map((s) => s.latitude),
      ],
    );
  }
}

async function ingestDvf(pool: pg.Pool, departments: string[], fileCount: number) {
  const uncovered = departments.filter((d) => DVF_UNCOVERED_DEPARTMENTS.has(d));
  if (uncovered.length) throw new Error(`DVF ne couvre pas : ${uncovered.join(", ")} (Livre foncier / Mayotte).`);
  const files = (await listDvfFiles()).slice(-fileCount);
  console.log(`DVF : ${files.length} fichier(s) national(aux) : ${files.map((f) => f.title).join(", ")}`);

  const linesByDepartment = new Map<string, DvfLine[]>(departments.map((d) => [d, []]));
  const wanted = new Set(departments);
  for (const file of files) {
    let n = 0;
    for await (const record of streamDvf(file.url, wanted)) {
      linesByDepartment.get(record.code_departement)!.push(record);
      n++;
    }
    console.log(`  ${file.title} : ${n} lignes retenues pour ${departments.join(", ")}`);
  }

  for (const department of departments) {
    const lines = linesByDepartment.get(department)!;
    const byCommune = new Map<string, DvfLine[]>();
    for (const line of lines) {
      const list = byCommune.get(line.code_commune);
      if (list) list.push(line);
      else byCommune.set(line.code_commune, [line]);
    }
    const sales: CleanSale[] = [];
    const exclusions: Record<RuleId, number> = { R1: 0, R3: 0, R4: 0, R5: 0 };
    let mutations = 0;
    for (const communeLines of byCommune.values()) {
      const report = cleanDvf(communeLines);
      sales.push(...report.sales);
      mutations += report.mutations;
      for (const k of Object.keys(exclusions) as RuleId[]) exclusions[k] += report.exclusions[k];
    }
    const dataUntil = sales.reduce((max, s) => (s.date > max ? s.date : max), "");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const runId = await startRun(client, "dvf", department, files.map((f) => f.title).join(" + "), files.map((f) => f.url));
      await client.query("DELETE FROM ref.dvf_sales WHERE department = $1", [department]);
      await insertSales(client, sales, department, runId);
      await finishRun(client, runId, { lines: lines.length, kept: sales.length, exclusions: { mutations, ...exclusions }, dataUntil: dataUntil || null });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    console.log(`  département ${department} : ${lines.length} lignes, ${mutations} ventes, ${sales.length} retenues, exclusions ${JSON.stringify(exclusions)}, jusqu'au ${dataUntil}`);
  }
}

async function ingestRents(pool: pg.Pool) {
  const { dataset, millesime } = await latestRentsDataset();
  const { rows, urls } = await downloadRents(dataset);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const runId = await startRun(client, "loyers", "france", String(millesime), urls);
    await client.query("DELETE FROM ref.rents WHERE millesime = $1", [millesime]);
    for (let i = 0; i < rows.length; i += BATCH) {
      const b = rows.slice(i, i + BATCH);
      await client.query(
        `INSERT INTO ref.rents (insee_code, segment, millesime, rent_per_sqm, low, high, prediction, obs_commune, obs_maille, r2_adj, source_run_id)
         SELECT ic, seg, $11, r, lo, hi, pr, oc, om, r2, $12
         FROM unnest($1::text[], $2::text[], $3::numeric[], $4::numeric[], $5::numeric[], $6::text[], $7::int[], $8::int[], $9::numeric[], $10::int[])
              AS x(ic, seg, r, lo, hi, pr, oc, om, r2, _)
         ON CONFLICT DO NOTHING`,
        [b.map((r) => r.inseeCode), b.map((r) => r.segment), b.map((r) => r.rentPerSqm), b.map((r) => r.low), b.map((r) => r.high),
         b.map((r) => r.prediction), b.map((r) => r.obsCommune), b.map((r) => r.obsMaille), b.map((r) => r.r2Adj), b.map(() => 0),
         millesime, runId],
      );
    }
    await finishRun(client, runId, { lines: rows.length, kept: rows.length });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  console.log(`Loyers ${millesime} : ${rows.length} lignes (4 types de bien).`);
}

async function ingestZonage(pool: pg.Pool) {
  const { rows, inForceFrom, url } = await downloadZonage();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const runId = await startRun(client, "zonage_abc", "france", inForceFrom, [url]);
    await client.query("DELETE FROM ref.zonage_abc");
    await client.query(
      `INSERT INTO ref.zonage_abc (insee_code, commune, zone, in_force_from, source_run_id)
       SELECT ic, c, z, $4::date, $5 FROM unnest($1::text[], $2::text[], $3::text[]) AS x(ic, c, z)
       ON CONFLICT DO NOTHING`,
      [rows.map((r) => r.inseeCode), rows.map((r) => r.commune), rows.map((r) => r.zone), inForceFrom, runId],
    );
    await finishRun(client, runId, { lines: rows.length, kept: rows.length });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  console.log(`Zonage ABC (en vigueur le ${inForceFrom}) : ${rows.length} communes.`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const url = process.env.DATABASE_URL_INGEST;
  if (!url) throw new Error("DATABASE_URL_INGEST manquant (rôle app_ingest).");
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  const option = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  try {
    if (command === "dvf") {
      const departments = (option("departements") ?? "").split(",").map((d) => d.trim()).filter(Boolean);
      if (!departments.length) throw new Error("Préciser --departements, par exemple 80,60.");
      await ingestDvf(pool, departments, Number(option("fichiers") ?? DEFAULT_DVF_FILES)).catch(async (e) => {
        await failRun(pool, "dvf", departments.join(","), e);
        throw e;
      });
    } else if (command === "loyers") {
      await ingestRents(pool).catch(async (e) => { await failRun(pool, "loyers", "france", e); throw e; });
    } else if (command === "zonage") {
      await ingestZonage(pool).catch(async (e) => { await failRun(pool, "zonage_abc", "france", e); throw e; });
    } else {
      throw new Error("Commande : dvf --departements 80 | loyers | zonage");
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: Error) => {
  console.error(`Échec : ${error.message}`);
  process.exit(1);
});
