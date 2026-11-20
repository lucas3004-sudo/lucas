/**
 * Tableau de bord du gérant (critère F13) : uniquement des chiffres MESURÉS, chacun avec sa
 * période. Sources : journal d'audit (créations, ajout seul : les éléments supprimés depuis
 * restent comptés) et tâches. Lecture réservée au gérant et aux managers, comme le journal
 * (la base refuse aussi : politique audit_read).
 */
import { withTenant } from "@immopilot/db";
import type { AgencyContext } from "../agency/context";
import type { PropertyStatus } from "../crm/labels";
import { getTenantPool } from "../server/db";

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

export function parsePeriod(raw: string | string[] | undefined): Period {
  const n = Number(raw);
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 30;
}

export const ACTIVITY_COLUMNS = [
  { key: "contact.cree", label: "Contacts créés" },
  { key: "consentement.enregistre", label: "Consentements enregistrés" },
  { key: "bien_agence.cree", label: "Biens ajoutés" },
  { key: "dossier.cree", label: "Dossiers de biens" },
  { key: "tache.creee", label: "Tâches créées" },
] as const;
type ActivityKey = (typeof ACTIVITY_COLUMNS)[number]["key"];

export interface MemberActivity {
  counts: Record<ActivityKey, number>;
  tasksDone: number;
  tasksOverdue: number;
}

export interface OverdueTask {
  id: string;
  title: string;
  assignee_user_id: string;
  due_on: string;
  contact_id: string | null;
  property_id: string | null;
}

export interface Pilotage {
  from: Date;
  to: Date;
  /** Activité par membre (clé : identifiant utilisateur). Les membres sans activité sont absents. */
  activity: Map<string, MemberActivity>;
  pipeline: Partial<Record<PropertyStatus, number>>;
  exclusiveMandates: number;
  overdue: OverdueTask[];
  overdueTotal: number;
}

const empty = (): MemberActivity => ({
  counts: Object.fromEntries(ACTIVITY_COLUMNS.map((c) => [c.key, 0])) as Record<ActivityKey, number>,
  tasksDone: 0,
  tasksOverdue: 0,
});

export async function loadPilotage(ctx: AgencyContext, days: Period): Promise<Pilotage> {
  return withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) => {
    const { from, to } = (await c.query<{ from: Date; to: Date }>(
      `SELECT now() - make_interval(days => $1) AS "from", now() AS "to"`, [days],
    )).rows[0]!;
    const activity = new Map<string, MemberActivity>();
    const row = (userId: string) => activity.get(userId) ?? activity.set(userId, empty()).get(userId)!;

    const audit = await c.query<{ user_id: string; action: ActivityKey; n: number }>(
      `SELECT actor_user_id AS user_id, action, count(*)::int AS n FROM app.audit_log
       WHERE at >= $1 AND action = ANY($2) GROUP BY 1, 2`,
      [from, ACTIVITY_COLUMNS.map((col) => col.key)],
    );
    for (const r of audit.rows) row(r.user_id).counts[r.action] = r.n;

    const done = await c.query<{ user_id: string; n: number }>(
      `SELECT assignee_user_id AS user_id, count(*)::int AS n FROM app.tasks WHERE status = 'faite' AND done_at >= $1 GROUP BY 1`, [from],
    );
    for (const r of done.rows) row(r.user_id).tasksDone = r.n;

    const today = `(now() AT TIME ZONE 'Europe/Paris')::date`;
    const late = await c.query<{ user_id: string; n: number }>(
      `SELECT assignee_user_id AS user_id, count(*)::int AS n FROM app.tasks WHERE status = 'a_faire' AND due_on < ${today} GROUP BY 1`,
    );
    for (const r of late.rows) row(r.user_id).tasksOverdue = r.n;

    const pipelineRows = await c.query<{ status: PropertyStatus; n: number }>(`SELECT status, count(*)::int AS n FROM app.properties GROUP BY 1`);
    const exclusive = await c.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM app.properties WHERE mandate_type = 'exclusif' AND status IN ('mandat', 'sous_offre')`,
    );
    const overdue = await c.query<OverdueTask>(
      `SELECT id, title, assignee_user_id, due_on::text, contact_id, property_id FROM app.tasks
       WHERE status = 'a_faire' AND due_on < ${today} ORDER BY due_on, created_at LIMIT 20`,
    );

    return {
      from,
      to,
      activity,
      pipeline: Object.fromEntries(pipelineRows.rows.map((r) => [r.status, r.n])),
      exclusiveMandates: exclusive.rows[0]?.n ?? 0,
      overdue: overdue.rows,
      overdueTotal: late.rows.reduce((sum, r) => sum + r.n, 0),
    };
  });
}
