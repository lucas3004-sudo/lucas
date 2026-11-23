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

describe("photos des biens (migration 0012)", () => {
  const A1 = () => ({ orgId: A, userId: users.negoA });
  const A2 = () => ({ orgId: A, userId: users.nego2A });
  const newProperty = (visibility: "private" | "agency") => (_db: unknown, c: pg.PoolClient) =>
    c.query(
      `INSERT INTO app.properties (org_id, owner_user_id, visibility, type, address_label, ban_id, insee_code, created_by)
       VALUES ($1, $2, $3, 'Maison', 'Adresse photo', 'ban-photo', '80021', $2) RETURNING id`,
      [A, users.negoA, visibility],
    ).then((r) => r.rows[0].id as string);
  const addPhoto = (propertyId: string, by: string) => (_db: unknown, c: pg.PoolClient) =>
    c.query(
      `INSERT INTO app.property_photos (org_id, property_id, content_type, bytes, width, height, created_by)
       VALUES ($1, $2, 'image/jpeg', '\\xffd8ffd9'::bytea, 10, 10, $3) RETURNING id`,
      [A, propertyId, by],
    ).then((r) => r.rows[0].id as string);

  it("photo d'un bien privé : visible par son responsable et le gérant, pas par un collègue ni l'autre agence", async () => {
    const prop = await withTenant(pool, A1(), newProperty("private"));
    const photo = await withTenant(pool, A1(), addPhoto(prop, users.negoA));
    await withTenant(pool, { orgId: A, userId: users.gerantA }, async (_db, c) => expect(await count(c, "app.property_photos", "id = $1", [photo])).toBe(1));
    await withTenant(pool, A2(), async (_db, c) => expect(await count(c, "app.property_photos", "id = $1", [photo])).toBe(0));
    await withTenant(pool, { orgId: B, userId: users.gerantB }, async (_db, c) => expect(await count(c, "app.property_photos")).toBe(0));
  });

  it("bien partagé : un collègue voit les photos mais n'en ajoute ni n'en supprime ; aucune modification possible", async () => {
    const prop = await withTenant(pool, A1(), newProperty("agency"));
    const photo = await withTenant(pool, A1(), addPhoto(prop, users.negoA));
    await withTenant(pool, A2(), async (_db, c) => {
      expect(await count(c, "app.property_photos", "id = $1", [photo])).toBe(1);
      expect((await c.query(`DELETE FROM app.property_photos WHERE id = $1`, [photo])).rowCount).toBe(0);
    });
    await expectDenied(withTenant(pool, A2(), addPhoto(prop, users.nego2A)));
    await expectDenied(withTenant(pool, A1(), (_db, c) => c.query(`UPDATE app.property_photos SET width = 20 WHERE id = $1`, [photo])));
    await withTenant(pool, A1(), async (_db, c) =>
      expect((await c.query(`DELETE FROM app.property_photos WHERE id = $1`, [photo])).rowCount).toBe(1));
  });
});

describe("agents : missions, étapes, approbations (migration 0014)", () => {
  const A1 = () => ({ orgId: A, userId: users.negoA });
  const A2 = () => ({ orgId: A, userId: users.nego2A });
  const GA = () => ({ orgId: A, userId: users.gerantA });
  const newMission = (by: string) => (_db: unknown, c: pg.PoolClient) =>
    c.query(`INSERT INTO app.missions (org_id, agent_id, agent_version, requested_by) VALUES ($1, 'duplicate-detection', '1.0.0', $2) RETURNING id`, [A, by])
      .then((r) => r.rows[0].id as string);
  const newApproval = (missionId: string, by: string) => (_db: unknown, c: pg.PoolClient) =>
    c.query(
      `INSERT INTO app.approvals (org_id, mission_id, agent_id, tool, level, title, payload, requested_by)
       VALUES ($1, $2, 'duplicate-detection', 'contacts.merge', 'L2', 'Fusion proposée', '{}'::jsonb, $3) RETURNING id`,
      [A, missionId, by],
    ).then((r) => r.rows[0].id as string);

  it("mission : visible par son demandeur et le gérant, pas par un collègue ni l'autre agence ; jamais au nom d'un autre", async () => {
    const m = await withTenant(pool, A1(), newMission(users.negoA));
    await withTenant(pool, GA(), async (_db, c) => expect(await count(c, "app.missions", "id = $1", [m])).toBe(1));
    await withTenant(pool, A2(), async (_db, c) => expect(await count(c, "app.missions", "id = $1", [m])).toBe(0));
    await withTenant(pool, { orgId: B, userId: users.gerantB }, async (_db, c) => expect(await count(c, "app.missions")).toBe(0));
    await expectDenied(withTenant(pool, A1(), newMission(users.nego2A)));
    await expectDenied(withTenant(pool, { orgId: A, userId: users.lectureA }, newMission(users.lectureA)));
    // Étapes : ajoutées par le demandeur seulement ; jamais modifiables.
    await withTenant(pool, A1(), (_db, c) =>
      c.query(`INSERT INTO app.mission_steps (org_id, mission_id, position, tool, level, status) VALUES ($1, $2, 1, 'contacts.duplicates', 'L0', 'ok')`, [A, m]));
    await expectDenied(withTenant(pool, A2(), (_db, c) =>
      c.query(`INSERT INTO app.mission_steps (org_id, mission_id, position, tool, level, status) VALUES ($1, $2, 2, 'x', 'L0', 'ok')`, [A, m])));
    await expectDenied(withTenant(pool, A1(), (_db, c) => c.query(`UPDATE app.mission_steps SET status = 'refuse'`)));
  });

  it("approbation : le négociateur décide pour ses missions, pas pour celles d'un collègue ; le gérant décide ; personne au nom d'un autre", async () => {
    const m1 = await withTenant(pool, A1(), newMission(users.negoA));
    const a1 = await withTenant(pool, A1(), newApproval(m1, users.negoA));
    const m2 = await withTenant(pool, A2(), newMission(users.nego2A));
    const a2 = await withTenant(pool, A2(), newApproval(m2, users.nego2A));
    // A1 ne voit pas l'approbation de A2 et ne peut pas la décider.
    await withTenant(pool, A1(), async (_db, c) => {
      expect(await count(c, "app.approvals", "id = $1", [a2])).toBe(0);
      expect((await c.query(`UPDATE app.approvals SET status = 'approuvee', decided_by = $2 WHERE id = $1`, [a2, users.negoA])).rowCount).toBe(0);
    });
    // Décider au nom d'un autre : refusé.
    await expectDenied(withTenant(pool, GA(), (_db, c) =>
      c.query(`UPDATE app.approvals SET status = 'approuvee', decided_by = $2 WHERE id = $1`, [a1, users.negoA])));
    // Contrôles positifs.
    await withTenant(pool, A1(), async (_db, c) =>
      expect((await c.query(`UPDATE app.approvals SET status = 'refusee', decided_by = $2, decided_at = now() WHERE id = $1`, [a1, users.negoA])).rowCount).toBe(1));
    await withTenant(pool, GA(), async (_db, c) =>
      expect((await c.query(`UPDATE app.approvals SET status = 'approuvee', decided_by = $2, decided_at = now() WHERE id = $1`, [a2, users.gerantA])).rowCount).toBe(1));
    // Une décision prise ne se modifie plus.
    await withTenant(pool, GA(), async (_db, c) =>
      expect((await c.query(`UPDATE app.approvals SET status = 'approuvee', decided_by = $2 WHERE id = $1`, [a1, users.gerantA])).rowCount).toBe(0));
    // Une approbation ne se crée que sur sa propre mission.
    await expectDenied(withTenant(pool, A2(), newApproval(m1, users.nego2A)));
  });

  it("activation d'un agent : réservée au gérant", async () => {
    await expectDenied(withTenant(pool, A1(), (_db, c) =>
      c.query(`INSERT INTO app.agent_settings (org_id, agent_id, enabled, updated_by) VALUES ($1, 'data-quality', false, $2)`, [A, users.negoA])));
    await withTenant(pool, GA(), (_db, c) =>
      c.query(`INSERT INTO app.agent_settings (org_id, agent_id, enabled, updated_by) VALUES ($1, 'data-quality', false, $2)`, [A, users.gerantA]));
    await withTenant(pool, A1(), async (_db, c) => expect(await count(c, "app.agent_settings", "agent_id = 'data-quality' AND NOT enabled")).toBe(1));
  });
});

describe("formule de l'agence (migration 0016)", () => {
  it("lisible par les membres de l'agence seulement, jamais modifiable par une agence (même le gérant)", async () => {
    await owner.query(`INSERT INTO app.agency_plans (org_id, plan) VALUES ($1, 'solo') ON CONFLICT (org_id) DO UPDATE SET plan = 'solo'`, [A]);
    await withTenant(pool, { orgId: A, userId: users.negoA }, async (_db, c) =>
      expect((await c.query(`SELECT plan FROM app.agency_plans`)).rows).toEqual([{ plan: "solo" }]));
    await withTenant(pool, { orgId: B, userId: users.gerantB }, async (_db, c) => expect(await count(c, "app.agency_plans")).toBe(0));
    await expectDenied(withTenant(pool, { orgId: A, userId: users.gerantA }, (_db, c) => c.query(`UPDATE app.agency_plans SET plan = 'agency'`)));
    await expectDenied(withTenant(pool, { orgId: B, userId: users.gerantB }, (_db, c) =>
      c.query(`INSERT INTO app.agency_plans (org_id, plan) VALUES ($1, 'agency')`, [B])));
  });

  it("consommation : compte les éléments privés des collègues sans les révéler, jamais ceux d'une autre agence", async () => {
    const monthStart = new Date(Date.now() - 31 * 86_400_000);
    const usage = (ctx: { orgId: string; userId: string }) =>
      withTenant(pool, ctx, async (_db, c) => (await c.query(`SELECT * FROM app.agency_usage($1)`, [monthStart])).rows[0]);
    const before = await usage({ orgId: A, userId: users.nego2A });
    await withTenant(pool, { orgId: A, userId: users.negoA }, (_db, c) =>
      c.query(`INSERT INTO app.contacts (org_id, owner_user_id, visibility, last_name, created_by) VALUES ($1, $2, 'private', 'Compté', $2)`, [A, users.negoA]));
    const after = await usage({ orgId: A, userId: users.nego2A });
    expect(after.contacts).toBe(before.contacts + 1); // privé de A1, compté pour A2…
    await withTenant(pool, { orgId: A, userId: users.nego2A }, async (_db, c) =>
      expect(await count(c, "app.contacts", "last_name = 'Compté'")).toBe(0)); // …mais toujours invisible
    expect(after.membres).toBe(4); // gérant, deux négociateurs, lecture seule
    const other = await usage({ orgId: B, userId: users.gerantB });
    expect(other.membres).toBe(1);
    expect(other.contacts).toBe(0);
    // Hors contexte d'agence (ou agence dont on n'est pas membre) : aucun chiffre.
    expect(await usage({ orgId: B, userId: users.negoA })).toBeUndefined();
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

describe("comptes rendus de visite (migration 0018)", () => {
  const A1 = () => ({ orgId: A, userId: users.negoA });
  const A2 = () => ({ orgId: A, userId: users.nego2A });
  const GA = () => ({ orgId: A, userId: users.gerantA });
  const LA = () => ({ orgId: A, userId: users.lectureA });
  // Bien confié à A2 ; visite organisée par A1 pour ce bien.
  const setup = async (kind = "visite") => {
    const propertyId = await withTenant(pool, A2(), (_db, c) =>
      c.query(
        `INSERT INTO app.properties (org_id, owner_user_id, visibility, type, address_label, ban_id, insee_code, created_by)
         VALUES ($1, $2, 'agency', 'Maison', 'Bien visité', 'ban-visite', '80021', $2) RETURNING id`,
        [A, users.nego2A],
      ).then((r) => r.rows[0].id as string));
    const appointmentId = await withTenant(pool, A1(), (_db, c) =>
      c.query(
        `INSERT INTO app.appointments (org_id, organizer_user_id, created_by, kind, title, starts_at, ends_at, property_id)
         VALUES ($1, $2, $2, $3, 'Visite du bien', now() - interval '2 hours', now() - interval '1 hour', $4) RETURNING id`,
        [A, users.negoA, kind, propertyId],
      ).then((r) => r.rows[0].id as string));
    return { propertyId, appointmentId };
  };
  const report = (appointmentId: string, propertyId: string | null, author: string) => (_db: unknown, c: pg.PoolClient) =>
    c.query(
      `INSERT INTO app.visit_reports (org_id, appointment_id, property_id, author_user_id, interest, next_step)
       VALUES ($1, $2, $3, $4, 'fort', 'offre') RETURNING id`,
      [A, appointmentId, propertyId, author],
    ).then((r) => r.rows[0].id as string);

  it("visible par l'auteur, le responsable du bien et le gérant ; ni par la lecture seule, ni par l'autre agence", async () => {
    const { propertyId, appointmentId } = await setup();
    const id = await withTenant(pool, A1(), report(appointmentId, propertyId, users.negoA));
    for (const ctx of [A1(), A2(), GA()]) {
      await withTenant(pool, ctx, async (_db, c) => expect(await count(c, "app.visit_reports", "id = $1", [id])).toBe(1));
    }
    await withTenant(pool, LA(), async (_db, c) => expect(await count(c, "app.visit_reports", "id = $1", [id])).toBe(0));
    await withTenant(pool, { orgId: B, userId: users.gerantB }, async (_db, c) => expect(await count(c, "app.visit_reports")).toBe(0));
  });

  it("seulement sur une visite que l'on voit, de type visite, pour le bien de la visite ; jamais en lecture seule", async () => {
    const { propertyId, appointmentId } = await setup();
    // A2 ne voit pas la visite organisée par A1 (RLS des rendez-vous).
    await expectDenied(withTenant(pool, A2(), report(appointmentId, propertyId, users.nego2A)));
    // Au nom d'un autre, ou en lecture seule : refusé.
    await expectDenied(withTenant(pool, A1(), report(appointmentId, propertyId, users.nego2A)));
    await expectDenied(withTenant(pool, LA(), report(appointmentId, propertyId, users.lectureA)));
    // Bien différent de celui de la visite : refusé.
    await expectDenied(withTenant(pool, A1(), report(appointmentId, null, users.negoA)));
    // Une estimation n'est pas une visite.
    const estimation = await setup("estimation");
    await expectDenied(withTenant(pool, A1(), report(estimation.appointmentId, estimation.propertyId, users.negoA)));
  });

  it("le contenu se modifie, jamais la visite, le bien ni l'auteur ; le responsable du bien ne modifie pas", async () => {
    const { propertyId, appointmentId } = await setup();
    const id = await withTenant(pool, A1(), report(appointmentId, propertyId, users.negoA));
    await withTenant(pool, A1(), async (_db, c) =>
      expect((await c.query(`UPDATE app.visit_reports SET interest = 'moyen', objections = 'Prix' WHERE id = $1`, [id])).rowCount).toBe(1));
    await expectDenied(withTenant(pool, GA(), (_db, c) => c.query(`UPDATE app.visit_reports SET author_user_id = $2 WHERE id = $1`, [id, users.gerantA])));
    await expectDenied(withTenant(pool, A1(), (_db, c) => c.query(`UPDATE app.visit_reports SET property_id = NULL WHERE id = $1`, [id])));
    await withTenant(pool, A2(), async (_db, c) =>
      expect((await c.query(`UPDATE app.visit_reports SET interest = 'aucun' WHERE id = $1`, [id])).rowCount).toBe(0));
  });
});

describe("suivi des mandats (migration 0019)", () => {
  const newProperty = (orgId: string, owner: string, mandateNumber: string | null) => (_db: unknown, c: pg.PoolClient) =>
    c.query(
      `INSERT INTO app.properties (org_id, owner_user_id, visibility, status, type, address_label, ban_id, insee_code, created_by, mandate_number)
       VALUES ($1, $2, 'private', 'mandat', 'Maison', 'Bien sous mandat', 'ban-mandat', '80021', $2, $3) RETURNING id`,
      [orgId, owner, mandateNumber],
    ).then((r) => r.rows[0].id as string);

  it("un numéro de mandat ne sert qu'une fois par agence, même sur un bien privé d'un collègue ; l'autre agence peut le réutiliser", async () => {
    expect(await withTenant(pool, { orgId: A, userId: users.negoA }, newProperty(A, users.negoA, "M-2026-001"))).toBeTruthy();
    await expect(withTenant(pool, { orgId: A, userId: users.nego2A }, newProperty(A, users.nego2A, "M-2026-001"))).rejects.toMatchObject({ code: "23505" });
    expect(await withTenant(pool, { orgId: B, userId: users.gerantB }, newProperty(B, users.gerantB, "M-2026-001"))).toBeTruthy();
    // Plusieurs biens sans numéro : autorisé.
    expect(await withTenant(pool, { orgId: A, userId: users.negoA }, newProperty(A, users.negoA, null))).toBeTruthy();
    expect(await withTenant(pool, { orgId: A, userId: users.negoA }, newProperty(A, users.negoA, null))).toBeTruthy();
  });

  it("la date de fin suit la signature ; seul un ayant droit du bien modifie son mandat", async () => {
    const id = await withTenant(pool, { orgId: A, userId: users.negoA }, newProperty(A, users.negoA, null));
    await expect(withTenant(pool, { orgId: A, userId: users.negoA }, (_db, c) =>
      c.query(`UPDATE app.properties SET mandate_signed_on = '2026-11-01', mandate_ends_on = '2026-10-01' WHERE id = $1`, [id])))
      .rejects.toMatchObject({ code: "23514" });
    await withTenant(pool, { orgId: A, userId: users.negoA }, async (_db, c) =>
      expect((await c.query(`UPDATE app.properties SET mandate_signed_on = '2026-11-01', mandate_ends_on = '2027-02-01' WHERE id = $1`, [id])).rowCount).toBe(1));
    // Bien privé : un collègue ne le voit pas, donc ne le modifie pas ; le gérant oui.
    await withTenant(pool, { orgId: A, userId: users.nego2A }, async (_db, c) =>
      expect((await c.query(`UPDATE app.properties SET mandate_ends_on = '2030-01-01' WHERE id = $1`, [id])).rowCount).toBe(0));
    await withTenant(pool, { orgId: A, userId: users.gerantA }, async (_db, c) =>
      expect((await c.query(`UPDATE app.properties SET mandate_ends_on = '2027-03-01' WHERE id = $1`, [id])).rowCount).toBe(1));
  });
});

describe("historique des biens (migration 0021)", () => {
  const newProperty = (visibility: "private" | "agency") => (_db: unknown, c: pg.PoolClient) =>
    c.query(
      `INSERT INTO app.properties (org_id, owner_user_id, visibility, status, type, address_label, ban_id, insee_code, created_by, price)
       VALUES ($1, $2, $3, 'mandat', 'Maison', 'Bien historisé', 'ban-hist', '80021', $2, 250000) RETURNING id`,
      [A, users.negoA, visibility],
    ).then((r) => r.rows[0].id as string);
  const events = (c: pg.PoolClient, id: string) =>
    c.query(`SELECT kind, old_value, new_value, actor_user_id FROM app.property_events WHERE property_id = $1 ORDER BY id`, [id]).then((r) => r.rows);

  it("la base note la création, les changements de prix, de statut et de mandat, avec leur auteur", async () => {
    const id = await withTenant(pool, { orgId: A, userId: users.negoA }, newProperty("private"));
    await withTenant(pool, { orgId: A, userId: users.negoA }, async (_db, c) => {
      await c.query(`UPDATE app.properties SET price = 239000 WHERE id = $1`, [id]);
      await c.query(`UPDATE app.properties SET status = 'sous_offre', mandate_type = 'exclusif' WHERE id = $1`, [id]);
      await c.query(`UPDATE app.properties SET notes = 'sans effet sur l''historique' WHERE id = $1`, [id]);
      expect(await events(c, id)).toEqual([
        { kind: "cree", old_value: null, new_value: "250000", actor_user_id: users.negoA },
        { kind: "prix", old_value: "250000", new_value: "239000", actor_user_id: users.negoA },
        { kind: "statut", old_value: "mandat", new_value: "sous_offre", actor_user_id: users.negoA },
        { kind: "mandat", old_value: null, new_value: "exclusif", actor_user_id: users.negoA },
      ]);
    });
  });

  it("même visibilité que le bien : ni le collègue (bien privé) ni l'autre agence ne lisent l'historique", async () => {
    const id = await withTenant(pool, { orgId: A, userId: users.negoA }, newProperty("private"));
    await withTenant(pool, { orgId: A, userId: users.gerantA }, async (_db, c) => expect(await count(c, "app.property_events", "property_id = $1", [id])).toBe(1));
    await withTenant(pool, { orgId: A, userId: users.nego2A }, async (_db, c) => expect(await count(c, "app.property_events", "property_id = $1", [id])).toBe(0));
    await withTenant(pool, { orgId: B, userId: users.gerantB }, async (_db, c) => expect(await count(c, "app.property_events", "property_id = $1", [id])).toBe(0));
    const shared = await withTenant(pool, { orgId: A, userId: users.negoA }, newProperty("agency"));
    await withTenant(pool, { orgId: A, userId: users.nego2A }, async (_db, c) => expect(await count(c, "app.property_events", "property_id = $1", [shared])).toBe(1));
  });

  it("le site ne peut ni écrire, ni modifier, ni effacer l'historique, même le gérant", async () => {
    const id = await withTenant(pool, { orgId: A, userId: users.negoA }, newProperty("agency"));
    await expectDenied(withTenant(pool, { orgId: A, userId: users.gerantA }, (_db, c) =>
      c.query(`INSERT INTO app.property_events (org_id, property_id, kind, new_value) VALUES ($1, $2, 'prix', '1')`, [A, id])));
    await expectDenied(withTenant(pool, { orgId: A, userId: users.gerantA }, (_db, c) =>
      c.query(`UPDATE app.property_events SET new_value = '1' WHERE property_id = $1`, [id])));
    await expectDenied(withTenant(pool, { orgId: A, userId: users.gerantA }, (_db, c) =>
      c.query(`DELETE FROM app.property_events WHERE property_id = $1`, [id])));
    // Contrôle positif : l'historique est bien là.
    await withTenant(pool, { orgId: A, userId: users.gerantA }, async (_db, c) => expect(await count(c, "app.property_events", "property_id = $1", [id])).toBe(1));
  });
});

describe("abonnements (migration 0020)", () => {
  const apply = (org: string, status: string, plan: string, sub: string | null) => (_db: unknown, c: pg.PoolClient) =>
    c.query("SELECT app.apply_subscription($1, $2, $3, 0, 'cus_Test123', $4, now() + interval '30 days')", [org, status, plan, sub]);

  it("le site ne peut pas écrire un abonnement directement ; seule la fonction le fait, et aligne la formule", async () => {
    await expectDenied(withTenant(pool, { orgId: A, userId: users.gerantA }, (_db, c) =>
      c.query(`INSERT INTO app.agency_subscriptions (org_id, status, plan) VALUES ($1, 'actif', 'agency')`, [A])));
    await withTenant(pool, { orgId: A, userId: users.gerantA }, apply(A, "actif", "pro", "sub_TestA1"));
    await withTenant(pool, { orgId: A, userId: users.negoA }, async (_db, c) => {
      expect((await c.query("SELECT status, plan, past_due_since FROM app.agency_subscriptions")).rows).toEqual([{ status: "actif", plan: "pro", past_due_since: null }]);
      expect((await c.query("SELECT plan FROM app.agency_plans")).rows).toEqual([{ plan: "pro" }]);
      // Lecture seule pour le site.
      expect((await c.query(`UPDATE app.agency_subscriptions SET status = 'actif'`).catch((e) => e)).code).toBe("42501");
    });
    await withTenant(pool, { orgId: B, userId: users.gerantB }, async (_db, c) => expect(await count(c, "app.agency_subscriptions")).toBe(0));
  });

  it("retard de paiement daté une seule fois (idempotent) ; résiliation : retour aux quotas par défaut", async () => {
    await withTenant(pool, { orgId: A, userId: users.gerantA }, apply(A, "en_retard", "pro", "sub_TestA1"));
    const first = await withTenant(pool, { orgId: A, userId: users.gerantA }, async (_db, c) =>
      (await c.query("SELECT past_due_since FROM app.agency_subscriptions")).rows[0].past_due_since as Date);
    expect(first).toBeInstanceOf(Date);
    await withTenant(pool, { orgId: A, userId: users.gerantA }, apply(A, "en_retard", "pro", "sub_TestA1"));
    await withTenant(pool, { orgId: A, userId: users.gerantA }, async (_db, c) =>
      expect((await c.query("SELECT past_due_since FROM app.agency_subscriptions")).rows[0].past_due_since).toEqual(first));
    await withTenant(pool, { orgId: A, userId: users.gerantA }, apply(A, "annule", "pro", "sub_TestA1"));
    await withTenant(pool, { orgId: A, userId: users.gerantA }, async (_db, c) => {
      expect((await c.query("SELECT status FROM app.agency_subscriptions")).rows).toEqual([{ status: "annule" }]);
      expect(await count(c, "app.agency_plans")).toBe(0);
    });
    // Agence inconnue : refusée.
    await expect(withTenant(pool, { orgId: A, userId: users.gerantA }, apply("00000000-0000-4000-8000-000000000000", "actif", "pro", null)))
      .rejects.toMatchObject({ code: "23503" });
  });
});
