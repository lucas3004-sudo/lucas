/**
 * Opportunity Finder v1 (F11) : quand un bien proposé est créé ou importé, chaque collègue dont
 * un profil de recherche actif atteint le seuil reçoit une tâche, sans que l'identité de son
 * acquéreur ne soit révélée à l'auteur. Un seul signalement ouvert par collègue et par bien
 * (même règle que le bouton « Prévenir »).
 */
import { matchProperty, type MatchProfile, type MatchProperty } from "@immopilot/domain";
import type pg from "pg";
import { MATCHABLE_STATUSES, type PropertyStatus } from "./labels";

export const ALERT_THRESHOLD = 75;
export const ALERT_TITLE_PREFIX = "Bien correspondant";

export interface OwnerMatch {
  ownerUserId: string;
  best: number;
  count: number;
}

/** Meilleur score et nombre de profils au-dessus du seuil, par responsable (l'auteur exclu). */
export function matchesByOwner(
  property: MatchProperty,
  profiles: ReadonlyArray<{ ownerUserId: string; profile: MatchProfile }>,
  authorUserId: string,
  threshold = ALERT_THRESHOLD,
): OwnerMatch[] {
  const byOwner = new Map<string, OwnerMatch>();
  for (const { ownerUserId, profile } of profiles) {
    if (ownerUserId === authorUserId) continue;
    const r = matchProperty(property, profile);
    if (!r.compatible || r.score < threshold) continue;
    const current = byOwner.get(ownerUserId) ?? { ownerUserId, best: 0, count: 0 };
    current.best = Math.max(current.best, r.score);
    current.count += 1;
    byOwner.set(ownerUserId, current);
  }
  return [...byOwner.values()].sort((a, b) => b.best - a.best);
}

const NUM = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/**
 * À appeler DANS la transaction de création du bien (client sous withTenant).
 * Renvoie les identifiants des tâches créées (une par collègue prévenu). Les profils sont lus sous RLS (critères lisibles
 * par toute l'agence) ; l'insertion des tâches est contrôlée par la base (membre de l'agence).
 */
export async function alertMatchingBuyers(
  c: pg.PoolClient,
  params: {
    orgId: string;
    authorUserId: string;
    authorName: string;
    propertyId: string;
    status: PropertyStatus;
    label: string;
    property: MatchProperty;
  },
): Promise<string[]> {
  if (!MATCHABLE_STATUSES.includes(params.status)) return [];
  const { rows } = await c.query(
    `SELECT owner_user_id, types, budget_max, surface_min, rooms_min, insee_codes, features FROM app.buyer_profiles WHERE status = 'actif'`,
  );
  const profiles = rows.map((r) => ({
    ownerUserId: r.owner_user_id as string,
    profile: {
      types: r.types,
      budgetMax: NUM(r.budget_max),
      surfaceMin: NUM(r.surface_min),
      roomsMin: NUM(r.rooms_min),
      inseeCodes: r.insee_codes,
      features: r.features,
    } as MatchProfile,
  }));
  const taskIds: string[] = [];
  for (const m of matchesByOwner(params.property, profiles, params.authorUserId)) {
    const already = await c.query(
      `SELECT 1 FROM app.tasks WHERE created_by = $1 AND assignee_user_id = $2 AND property_id = $3 AND status = 'a_faire' AND title LIKE $4`,
      [params.authorUserId, m.ownerUserId, params.propertyId, `${ALERT_TITLE_PREFIX}%`],
    );
    if (already.rowCount) continue;
    // Le responsable du profil peut avoir quitté l'agence : la base refuserait la tâche.
    const member = await c.query(`SELECT app.is_member($1) AS ok`, [m.ownerUserId]);
    if (!member.rows[0]?.ok) continue;
    const inserted = await c.query<{ id: string }>(
      `INSERT INTO app.tasks (org_id, assignee_user_id, created_by, title, details, property_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        params.orgId,
        m.ownerUserId,
        params.authorUserId,
        `${ALERT_TITLE_PREFIX} à vos acquéreurs (${m.best} %)`,
        `Nouveau bien ajouté par ${params.authorName} : « ${params.label} ». Il correspond à ${m.count} de vos profils de recherche (meilleur score ${m.best} %).`,
        params.propertyId,
      ],
    );
    taskIds.push(inserted.rows[0]!.id);
  }
  return taskIds;
}
