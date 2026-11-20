/**
 * Tests d'attaque de l'isolation entre agences, sur une vraie base PostgreSQL migrée.
 * Repris du prototype (prototypes/rls, D-016) et appliqués aux tables réelles.
 *
 * Règle : chaque test de refus est accompagné d'un CONTRÔLE POSITIF, sinon un « 0 ligne »
 * peut réussir alors que rien ne fonctionne (leçon du prototype).
 *
 * Variables : TEST_DATABASE_URL_OWNER (migrations, données de test) et TEST_DATABASE_URL
 * (rôle app_user). Valeurs par défaut : base locale de ./scripts/dev-db.sh.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../migrate";
import { withTenant } from "../tenant";

const OWNER_URL = process.env.TEST_DATABASE_URL_OWNER ?? "postgres://app_owner:dev_owner@127.0.0.1:54320/immopilot_test";
const USER_URL = process.env.TEST_DATABASE_URL ?? "postgres://app_user:dev_user@127.0.0.1:54320/immopilot_test";

const owner = new pg.Pool({ connectionString: OWNER_URL, max: 2 });
// Une seule connexion : garantit que les tests de « fuite » réutilisent la même session.
const pool = new pg.Pool({ connectionString: USER_URL, max: 1 });

const A = randomUUID();
const B = randomUUID();
const users = { gerantA: randomUUID(), negoA: randomUUID(), gerantB: randomUUID() };

async function expectDenied(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({ code: "42501" });
}

beforeAll(async () => {
  await migrate(OWNER_URL, () => undefined);
  const now = new Date();
  for (const [key, id] of Object.entries(users)) {
    await owner.query(
      `INSERT INTO iam."user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, true)`,
      [id, key, `${key}-${id}@test.invalid`],
    );
  }
  for (const [id, name] of [[A, "Agence A"], [B, "Agence B"]] as const) {
    await owner.query(`INSERT INTO iam.organization (id, name, slug, "createdAt") VALUES ($1, $2, $3, $4)`, [
      id, name, `${name.toLowerCase().replace(" ", "-")}-${id}`, now,
    ]);
  }
  for (const [userId, orgId, role] of [
    [users.gerantA, A, "gerant"],
    [users.negoA, A, "negociateur"],
    [users.gerantB, B, "gerant"],
  ] as const) {
    await owner.query(
      `INSERT INTO iam.member ("organizationId", "userId", role, "createdAt") VALUES ($1, $2, $3, $4)`,
      [orgId, userId, role, now],
    );
  }
  // Données de départ, écrites par les gérants eux-mêmes (donc via la RLS).
  for (const [orgId, userId] of [[A, users.gerantA], [B, users.gerantB]] as const) {
    await withTenant(pool, { orgId, userId }, async (_db, c) => {
      await c.query(`INSERT INTO app.organization_settings (org_id, default_visibility, updated_by) VALUES ($1, 'agency', $2)`, [orgId, userId]);
      await c.query(`INSERT INTO app.audit_log (org_id, actor_user_id, action) VALUES ($1, $2, 'test.seed')`, [orgId, userId]);
    });
  }
});

afterAll(async () => {
  await owner.query(`DELETE FROM iam.organization WHERE id = ANY($1)`, [[A, B]]);
  await owner.query(`DELETE FROM iam."user" WHERE id = ANY($1)`, [Object.values(users)]);
  await pool.end();
  await owner.end();
});

const count = async (c: pg.PoolClient, table: string, where = "true", params: unknown[] = []) =>
  Number((await c.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, params)).rows[0].n);

describe("isolation entre agences (RLS)", () => {
  it("sans contexte : rien n'est visible et rien ne s'écrit", async () => {
    const c = await pool.connect();
    try {
      expect(await count(c, "app.organization_settings")).toBe(0);
      expect(await count(c, "app.audit_log")).toBe(0);
      await expectDenied(c.query(`INSERT INTO app.audit_log (org_id, actor_user_id, action) VALUES ($1, $2, 'x')`, [A, users.gerantA]));
    } finally {
      c.release();
    }
  });

  it("le gérant voit son agence (contrôle positif) et rien de l'autre", async () => {
    await withTenant(pool, { orgId: A, userId: users.gerantA }, async (_db, c) => {
      expect(await count(c, "app.organization_settings")).toBe(1);
      expect(await count(c, "app.audit_log", "action = 'test.seed'")).toBe(1);
      expect(await count(c, "app.organization_settings", "org_id = $1", [B])).toBe(0);
      expect(await count(c, "app.audit_log", "org_id = $1", [B])).toBe(0);
    });
  });

  it("un contexte d'agence dont on n'est pas membre ne donne accès à rien", async () => {
    await withTenant(pool, { orgId: B, userId: users.gerantA }, async (_db, c) => {
      expect(await count(c, "app.organization_settings")).toBe(0);
      expect(await count(c, "app.audit_log")).toBe(0);
      await expectDenied(c.query(`INSERT INTO app.audit_log (org_id, actor_user_id, action) VALUES ($1, $2, 'x')`, [B, users.gerantA]));
    });
  });

  it("écrire dans une autre agence est refusé ; viser ses lignes ne touche rien", async () => {
    await expectDenied(
      withTenant(pool, { orgId: A, userId: users.gerantA }, (_db, c) =>
        c.query(`INSERT INTO app.audit_log (org_id, actor_user_id, action) VALUES ($1, $2, 'x')`, [B, users.gerantA])),
    );
    await withTenant(pool, { orgId: A, userId: users.gerantA }, async (_db, c) => {
      const own = await c.query(`UPDATE app.organization_settings SET updated_by = $1 WHERE org_id = $2`, [users.gerantA, A]);
      const other = await c.query(`UPDATE app.organization_settings SET updated_by = $1 WHERE org_id = $2`, [users.gerantA, B]);
      expect(own.rowCount).toBe(1);
      expect(other.rowCount).toBe(0);
    });
  });

  it("un négociateur lit les paramètres mais ne les modifie pas, et ne lit pas le journal", async () => {
    await withTenant(pool, { orgId: A, userId: users.negoA }, async (_db, c) => {
      expect(await count(c, "app.organization_settings")).toBe(1);
      const update = await c.query(`UPDATE app.organization_settings SET default_visibility = 'private' WHERE org_id = $1`, [A]);
      expect(update.rowCount).toBe(0);
      expect(await count(c, "app.audit_log")).toBe(0);
    });
  });

  it("chacun journalise ses propres actions, jamais au nom d'un autre", async () => {
    await withTenant(pool, { orgId: A, userId: users.negoA }, (_db, c) =>
      c.query(`INSERT INTO app.audit_log (org_id, actor_user_id, action) VALUES ($1, $2, 'test.own')`, [A, users.negoA]));
    await expectDenied(
      withTenant(pool, { orgId: A, userId: users.negoA }, (_db, c) =>
        c.query(`INSERT INTO app.audit_log (org_id, actor_user_id, action) VALUES ($1, $2, 'test.forged')`, [A, users.gerantA])),
    );
  });

  it("le journal d'audit est en ajout seul, même pour le gérant", async () => {
    await expectDenied(withTenant(pool, { orgId: A, userId: users.gerantA }, (_db, c) => c.query(`UPDATE app.audit_log SET action = 'x'`)));
    await expectDenied(withTenant(pool, { orgId: A, userId: users.gerantA }, (_db, c) => c.query(`DELETE FROM app.audit_log`)));
  });

  it("le contexte ne survit pas à la transaction (même connexion réutilisée)", async () => {
    await withTenant(pool, { orgId: A, userId: users.gerantA }, async (_db, c) => {
      expect(await count(c, "app.organization_settings")).toBe(1);
    });
    const c = await pool.connect();
    try {
      const { rows } = await c.query(`SELECT coalesce(current_setting('app.org_id', true), '') AS org`);
      expect(rows[0].org).toBe("");
      expect(await count(c, "app.organization_settings")).toBe(0);
    } finally {
      c.release();
    }
  });

  it("le rôle applicatif n'accède pas au schéma d'authentification", async () => {
    const c = await pool.connect();
    try {
      await expectDenied(c.query(`SELECT count(*) FROM iam."user"`));
    } finally {
      c.release();
    }
  });
});

describe("garde-fou : aucune table d'agence n'échappe à la RLS", () => {
  it("chaque table du schéma app a la RLS activée, forcée, et une politique restrictive d'isolation", async () => {
    const { rows } = await owner.query<{ table: string; enabled: boolean; forced: boolean; restrictive: number }>(`
      SELECT c.relname AS table, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
             (SELECT count(*)::int FROM pg_policies p
              WHERE p.schemaname = 'app' AND p.tablename = c.relname
                AND p.permissive = 'RESTRICTIVE' AND p.cmd = 'ALL'
                AND p.qual LIKE '%ctx_org()%' AND p.qual LIKE '%ctx_role()%') AS restrictive
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'app' AND c.relkind = 'r'
      ORDER BY 1`);
    expect(rows.length).toBeGreaterThan(0);
    const unsafe = rows.filter((r) => !r.enabled || !r.forced || r.restrictive < 1).map((r) => r.table);
    expect(unsafe).toEqual([]);
  });

  it("le rôle applicatif ne peut ni contourner la RLS ni vider une table", async () => {
    const role = await owner.query(`SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'app_user'`);
    expect(role.rows[0]).toEqual({ rolbypassrls: false, rolsuper: false });
    const { rows } = await owner.query(`
      SELECT table_name, privilege_type FROM information_schema.role_table_grants
      WHERE grantee = 'app_user' AND table_schema = 'app' AND privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER')`);
    expect(rows).toEqual([]);
  });
});
