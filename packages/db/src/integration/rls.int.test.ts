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
const users = { gerantA: randomUUID(), negoA: randomUUID(), nego2A: randomUUID(), lectureA: randomUUID(), gerantB: randomUUID() };

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
    [users.nego2A, A, "negociateur"],
    [users.lectureA, A, "lecture"],
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

describe("dossiers de biens (app.analyses)", () => {
  const insert = (c: pg.PoolClient, orgId: string, by: string) =>
    c.query(
      `INSERT INTO app.analyses (org_id, created_by, address_label, ban_id, insee_code, inputs, snapshot)
       VALUES ($1, $2, 'adresse test', '80021_0000_00001', '80021', '{}', '{}') RETURNING id`,
      [orgId, by],
    );

  it("un négociateur crée un dossier (contrôle positif), visible par le gérant, pas par l'autre agence", async () => {
    const id = await withTenant(pool, { orgId: A, userId: users.negoA }, async (_db, c) => (await insert(c, A, users.negoA)).rows[0].id);
    await withTenant(pool, { orgId: A, userId: users.gerantA }, async (_db, c) => {
      expect(await count(c, "app.analyses", "id = $1", [id])).toBe(1);
    });
    await withTenant(pool, { orgId: B, userId: users.gerantB }, async (_db, c) => {
      expect(await count(c, "app.analyses", "id = $1", [id])).toBe(0);
    });
  });

  it("un dossier est immuable, même pour le gérant", async () => {
    await expectDenied(withTenant(pool, { orgId: A, userId: users.gerantA }, (_db, c) => c.query(`UPDATE app.analyses SET snapshot = '{"x":1}'`)));
  });

  it("personne ne crée un dossier au nom d'un autre", async () => {
    await expectDenied(withTenant(pool, { orgId: A, userId: users.negoA }, (_db, c) => insert(c, A, users.gerantA)));
  });

  it("seuls le gérant et les managers suppriment", async () => {
    const id = await withTenant(pool, { orgId: A, userId: users.negoA }, async (_db, c) => (await insert(c, A, users.negoA)).rows[0].id);
    const byNego = await withTenant(pool, { orgId: A, userId: users.negoA }, (_db, c) => c.query(`DELETE FROM app.analyses WHERE id = $1`, [id]));
    expect(byNego.rowCount).toBe(0);
    const byGerant = await withTenant(pool, { orgId: A, userId: users.gerantA }, (_db, c) => c.query(`DELETE FROM app.analyses WHERE id = $1`, [id]));
    expect(byGerant.rowCount).toBe(1);
  });
});

describe("CRM : contacts, consentements, profils, biens, tâches (migration 0007)", () => {
  const A1 = () => ({ orgId: A, userId: users.negoA });
  const A2 = () => ({ orgId: A, userId: users.nego2A });
  const GA = () => ({ orgId: A, userId: users.gerantA });
  const newContact = (c: pg.PoolClient, owner: string, by: string, visibility: "private" | "agency", name: string) =>
    c.query(
      `INSERT INTO app.contacts (org_id, owner_user_id, visibility, roles, last_name, created_by)
       VALUES ($1, $2, $3, '{acquereur}', $4, $5) RETURNING id`,
      [A, owner, visibility, name, by],
    ).then((r) => r.rows[0].id as string);

  let privateId = "";
  let sharedId = "";

  beforeAll(async () => {
    privateId = await withTenant(pool, A1(), (_db, c) => newContact(c, users.negoA, users.negoA, "private", "Privé de A1"));
    sharedId = await withTenant(pool, A1(), (_db, c) => newContact(c, users.negoA, users.negoA, "agency", "Partagé de A1"));
  });

  it("contact privé : visible par son responsable et le gérant, pas par un collègue ni l'autre agence", async () => {
    await withTenant(pool, A1(), async (_db, c) => expect(await count(c, "app.contacts", "id = $1", [privateId])).toBe(1));
    await withTenant(pool, GA(), async (_db, c) => expect(await count(c, "app.contacts", "id = $1", [privateId])).toBe(1));
    await withTenant(pool, A2(), async (_db, c) => expect(await count(c, "app.contacts", "id = $1", [privateId])).toBe(0));
    await withTenant(pool, { orgId: B, userId: users.gerantB }, async (_db, c) => expect(await count(c, "app.contacts")).toBe(0));
  });

  it("contact partagé : lu par un collègue, modifié seulement par son responsable", async () => {
    await withTenant(pool, A2(), async (_db, c) => {
      expect(await count(c, "app.contacts", "id = $1", [sharedId])).toBe(1);
      expect((await c.query(`UPDATE app.contacts SET notes = 'x' WHERE id = $1`, [sharedId])).rowCount).toBe(0);
    });
    await withTenant(pool, A1(), async (_db, c) => {
      expect((await c.query(`UPDATE app.contacts SET notes = 'ok' WHERE id = $1`, [sharedId])).rowCount).toBe(1);
    });
  });

  it("un négociateur ne crée pas de contact au nom d'un collègue ; le gérant peut attribuer, mais pas à l'autre agence", async () => {
    await expectDenied(withTenant(pool, A1(), (_db, c) => newContact(c, users.nego2A, users.negoA, "agency", "Usurpé")));
    const assigned = await withTenant(pool, GA(), (_db, c) => newContact(c, users.nego2A, users.gerantA, "agency", "Attribué"));
    expect(assigned).toBeTruthy();
    await expectDenied(withTenant(pool, GA(), (_db, c) => newContact(c, users.gerantB, users.gerantA, "agency", "Hors agence")));
  });

  it("lecture seule : aucune création", async () => {
    await expectDenied(withTenant(pool, { orgId: A, userId: users.lectureA }, (_db, c) => newContact(c, users.lectureA, users.lectureA, "agency", "Lecteur")));
  });

  it("consentements : suivent la visibilité du contact, ne se modifient ni ne s'effacent", async () => {
    await withTenant(pool, A1(), (_db, c) =>
      c.query(
        `INSERT INTO app.contact_consents (org_id, contact_id, channel, status, obtained_at, proof, recorded_by)
         VALUES ($1, $2, 'telephone', 'accorde', current_date, 'Accord oral lors de la visite', $3)`,
        [A, privateId, users.negoA],
      ));
    await withTenant(pool, A1(), async (_db, c) => expect(await count(c, "app.contact_consents", "contact_id = $1", [privateId])).toBe(1));
    await withTenant(pool, A2(), async (_db, c) => expect(await count(c, "app.contact_consents", "contact_id = $1", [privateId])).toBe(0));
    await expectDenied(withTenant(pool, A1(), (_db, c) => c.query(`UPDATE app.contact_consents SET status = 'retire'`)));
    await expectDenied(withTenant(pool, A1(), (_db, c) => c.query(`DELETE FROM app.contact_consents`)));
  });

  it("profil d'un acquéreur privé : critères lisibles par un collègue (matching), identité invisible, aucune modification", async () => {
    const profileId = await withTenant(pool, A1(), async (_db, c) =>
      (await c.query(
        `INSERT INTO app.buyer_profiles (org_id, contact_id, owner_user_id, types, budget_max, created_by)
         VALUES ($1, $2, $3, '{Appartement}', 200000, $3) RETURNING id`,
        [A, privateId, users.negoA],
      )).rows[0].id as string);
    await withTenant(pool, A2(), async (_db, c) => {
      const { rows } = await c.query(
        `SELECT p.budget_max::int AS budget, ct.last_name AS name FROM app.buyer_profiles p
         LEFT JOIN app.contacts ct ON ct.id = p.contact_id WHERE p.id = $1`,
        [profileId],
      );
      expect(rows).toEqual([{ budget: 200000, name: null }]);
      expect((await c.query(`UPDATE app.buyer_profiles SET budget_max = 1 WHERE id = $1`, [profileId])).rowCount).toBe(0);
    });
    await expectDenied(withTenant(pool, A2(), (_db, c) =>
      c.query(`INSERT INTO app.buyer_profiles (org_id, contact_id, owner_user_id, created_by) VALUES ($1, $2, $3, $4)`, [A, privateId, users.negoA, users.nego2A])));
  });

  it("tâches : un collègue peut prévenir A1 ; jamais d'attribution hors agence ; lecture seule ne crée rien", async () => {
    await withTenant(pool, A2(), (_db, c) =>
      c.query(`INSERT INTO app.tasks (org_id, assignee_user_id, created_by, title) VALUES ($1, $2, $3, 'Acquéreur pour ton bien')`, [A, users.negoA, users.nego2A]));
    await withTenant(pool, A1(), async (_db, c) => expect(await count(c, "app.tasks", "title = 'Acquéreur pour ton bien'")).toBe(1));
    await withTenant(pool, { orgId: B, userId: users.gerantB }, async (_db, c) => expect(await count(c, "app.tasks")).toBe(0));
    await expectDenied(withTenant(pool, A2(), (_db, c) =>
      c.query(`INSERT INTO app.tasks (org_id, assignee_user_id, created_by, title) VALUES ($1, $2, $3, 'Hors agence')`, [A, users.gerantB, users.nego2A])));
    await expectDenied(withTenant(pool, { orgId: A, userId: users.lectureA }, (_db, c) =>
      c.query(`INSERT INTO app.tasks (org_id, assignee_user_id, created_by, title) VALUES ($1, $2, $2, 'Lecteur')`, [A, users.lectureA])));
  });

  it("réattribution : le gérant transfère un contact et ses profils ; le nouveau responsable prend la main, l'ancien la perd", async () => {
    const contactId = await withTenant(pool, A1(), (_db, c) => newContact(c, users.negoA, users.negoA, "private", "À transférer"));
    const profileId = await withTenant(pool, A1(), async (_db, c) =>
      (await c.query(
        `INSERT INTO app.buyer_profiles (org_id, contact_id, owner_user_id, types, created_by) VALUES ($1, $2, $3, '{Maison}', $3) RETURNING id`,
        [A, contactId, users.negoA],
      )).rows[0].id as string);
    // Même transaction, comme l'action « Modifier le contact » de l'application.
    await withTenant(pool, GA(), async (_db, c) => {
      expect((await c.query(`UPDATE app.contacts SET owner_user_id = $2 WHERE id = $1`, [contactId, users.nego2A])).rowCount).toBe(1);
      expect((await c.query(`UPDATE app.buyer_profiles SET owner_user_id = $2 WHERE contact_id = $1`, [contactId, users.nego2A])).rowCount).toBe(1);
    });
    await withTenant(pool, A2(), async (_db, c) => {
      expect(await count(c, "app.contacts", "id = $1", [contactId])).toBe(1);
      expect((await c.query(`UPDATE app.buyer_profiles SET status = 'en_pause' WHERE id = $1`, [profileId])).rowCount).toBe(1);
    });
    await withTenant(pool, A1(), async (_db, c) => {
      expect(await count(c, "app.contacts", "id = $1", [contactId])).toBe(0);
      expect((await c.query(`UPDATE app.buyer_profiles SET status = 'actif' WHERE id = $1`, [profileId])).rowCount).toBe(0);
    });
    // Un profil ne peut pas être rattaché à un autre responsable que celui du contact.
    await expectDenied(withTenant(pool, GA(), (_db, c) =>
      c.query(`UPDATE app.buyer_profiles SET owner_user_id = $2 WHERE id = $1`, [profileId, users.negoA])));
    const insertProfile = (owner: string) => (_db: unknown, c: pg.PoolClient) =>
      c.query(`INSERT INTO app.buyer_profiles (org_id, contact_id, owner_user_id, created_by) VALUES ($1, $2, $3, $4)`, [A, contactId, owner, users.nego2A]);
    await expectDenied(withTenant(pool, A2(), insertProfile(users.negoA)));
    await withTenant(pool, A2(), insertProfile(users.nego2A)); // contrôle positif
  });

  it("suppression d'un contact : refusée au négociateur (0 ligne), possible pour le gérant", async () => {
    await withTenant(pool, A1(), async (_db, c) =>
      expect((await c.query(`DELETE FROM app.contacts WHERE id = $1`, [sharedId])).rowCount).toBe(0));
    await withTenant(pool, GA(), async (_db, c) =>
      expect((await c.query(`DELETE FROM app.contacts WHERE id = $1`, [sharedId])).rowCount).toBe(1));
  });
});

describe("rendez-vous (migration 0009)", () => {
  const A1 = () => ({ orgId: A, userId: users.negoA });
  const A2 = () => ({ orgId: A, userId: users.nego2A });
  const GA = () => ({ orgId: A, userId: users.gerantA });
  const insert = (organizer: string, by: string, title: string) => (_db: unknown, c: pg.PoolClient) =>
    c.query(
      `INSERT INTO app.appointments (org_id, organizer_user_id, created_by, kind, title, starts_at, ends_at)
       VALUES ($1, $2, $3, 'visite', $4, now() + interval '1 day', now() + interval '1 day 1 hour') RETURNING id`,
      [A, organizer, by, title],
    ).then((r) => r.rows[0].id as string);

  it("un négociateur planifie pour lui-même (contrôle positif) ; visible par lui et le gérant, pas par un collègue ni l'autre agence", async () => {
    const id = await withTenant(pool, A1(), insert(users.negoA, users.negoA, "Visite A1"));
    await withTenant(pool, A1(), async (_db, c) => expect(await count(c, "app.appointments", "id = $1", [id])).toBe(1));
    await withTenant(pool, GA(), async (_db, c) => expect(await count(c, "app.appointments", "id = $1", [id])).toBe(1));
    await withTenant(pool, A2(), async (_db, c) => {
      expect(await count(c, "app.appointments", "id = $1", [id])).toBe(0);
      expect((await c.query(`UPDATE app.appointments SET status = 'annule' WHERE id = $1`, [id])).rowCount).toBe(0);
    });
    await withTenant(pool, { orgId: B, userId: users.gerantB }, async (_db, c) => expect(await count(c, "app.appointments")).toBe(0));
  });

  it("pas de rendez-vous au nom d'un collègue pour un négociateur ; le gérant peut, mais jamais hors agence ; lecture seule refusée", async () => {
    await expectDenied(withTenant(pool, A1(), insert(users.nego2A, users.negoA, "Usurpé")));
    expect(await withTenant(pool, GA(), insert(users.nego2A, users.gerantA, "Planifié par le gérant"))).toBeTruthy();
    await expectDenied(withTenant(pool, GA(), insert(users.gerantB, users.gerantA, "Hors agence")));
    await expectDenied(withTenant(pool, { orgId: A, userId: users.lectureA }, insert(users.lectureA, users.lectureA, "Lecteur")));
  });

  it("un rendez-vous ne peut pas être réattribué hors agence ni durer plus de 24 h", async () => {
    const id = await withTenant(pool, A1(), insert(users.negoA, users.negoA, "À modifier"));
    await expectDenied(withTenant(pool, GA(), (_db, c) => c.query(`UPDATE app.appointments SET organizer_user_id = $2 WHERE id = $1`, [id, users.gerantB])));
    // Durée : contrainte de cohérence de la table (code 23514), pas une règle d'accès.
    await expect(withTenant(pool, A1(), (_db, c) => c.query(`UPDATE app.appointments SET ends_at = starts_at + interval '25 hours' WHERE id = $1`, [id])))
      .rejects.toMatchObject({ code: "23514" });
    await withTenant(pool, A1(), async (_db, c) =>
      expect((await c.query(`UPDATE app.appointments SET status = 'annule' WHERE id = $1`, [id])).rowCount).toBe(1));
  });
});

describe("affaires (migration 0010)", () => {
  const A1 = () => ({ orgId: A, userId: users.negoA });
  const A2 = () => ({ orgId: A, userId: users.nego2A });
  const GA = () => ({ orgId: A, userId: users.gerantA });
  const newProperty = (visibility: "private" | "agency") => (_db: unknown, c: pg.PoolClient) =>
    c.query(
      `INSERT INTO app.properties (org_id, owner_user_id, visibility, type, address_label, ban_id, insee_code, created_by)
       VALUES ($1, $2, $3, 'Appartement', 'Adresse test', 'ban-test', '80021', $2) RETURNING id`,
      [A, users.negoA, visibility],
    ).then((r) => r.rows[0].id as string);
  const newDeal = (propertyId: string, owner: string) => (_db: unknown, c: pg.PoolClient) =>
    c.query(`INSERT INTO app.deals (org_id, property_id, owner_user_id, created_by) VALUES ($1, $2, $3, $3) RETURNING id`, [A, propertyId, owner])
      .then((r) => r.rows[0].id as string);

  it("une affaire suit la visibilité de son bien (contrôle positif, collègue, autre agence)", async () => {
    const privateProp = await withTenant(pool, A1(), newProperty("private"));
    const dealId = await withTenant(pool, A1(), newDeal(privateProp, users.negoA));
    await withTenant(pool, A1(), async (_db, c) => expect(await count(c, "app.deals", "id = $1", [dealId])).toBe(1));
    await withTenant(pool, GA(), async (_db, c) => expect(await count(c, "app.deals", "id = $1", [dealId])).toBe(1));
    await withTenant(pool, A2(), async (_db, c) => expect(await count(c, "app.deals", "id = $1", [dealId])).toBe(0));
    await withTenant(pool, { orgId: B, userId: users.gerantB }, async (_db, c) => expect(await count(c, "app.deals")).toBe(0));
    // Un collègue ne peut pas ouvrir d'affaire sur un bien qu'il ne voit pas.
    await expectDenied(withTenant(pool, A2(), newDeal(privateProp, users.nego2A)));
  });

  it("bien partagé : un collègue lit l'affaire mais ne la modifie pas ; le gérant peut", async () => {
    const sharedProp = await withTenant(pool, A1(), newProperty("agency"));
    const dealId = await withTenant(pool, A1(), newDeal(sharedProp, users.negoA));
    await withTenant(pool, A2(), async (_db, c) => {
      expect(await count(c, "app.deals", "id = $1", [dealId])).toBe(1);
      expect((await c.query(`UPDATE app.deals SET stage = 'abandon' WHERE id = $1`, [dealId])).rowCount).toBe(0);
    });
    await withTenant(pool, GA(), async (_db, c) =>
      expect((await c.query(`UPDATE app.deals SET stage = 'compromis' WHERE id = $1`, [dealId])).rowCount).toBe(1));
    await expectDenied(withTenant(pool, A1(), newDeal(sharedProp, users.nego2A))); // au nom d'un collègue
    await expectDenied(withTenant(pool, { orgId: A, userId: users.lectureA }, newDeal(sharedProp, users.lectureA)));
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
