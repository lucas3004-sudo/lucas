/** Lectures de l'Agent Center (la RLS limite chacun à ses missions, sauf gérant et managers). */
import { withTenant } from "@immopilot/db";
import type { AgencyContext } from "../agency/context";
import { contactName } from "../crm/data";
import { getTenantPool } from "../server/db";

export interface MissionRow {
  id: string;
  agent_id: string;
  agent_version: string;
  requested_by: string;
  status: "en_cours" | "reussie" | "echouee" | "attente_approbation" | "annulee";
  trigger: "manuel" | "auto";
  summary: { text?: string; counts?: Record<string, number> };
  error: string | null;
  steps: number;
  cost_micro_usd: string;
  started_at: Date;
  finished_at: Date | null;
}

export interface ApprovalRow {
  id: string;
  mission_id: string;
  agent_id: string;
  tool: string;
  level: "L2" | "L3";
  title: string;
  payload: Record<string, unknown>;
  requested_by: string;
  status: "en_attente" | "approuvee" | "refusee" | "expiree" | "echouee";
  decided_by: string | null;
  decided_at: Date | null;
  result: Record<string, unknown> | null;
  created_at: Date;
  expires_at: Date;
  /** Contacts concernés (fusion), seulement s'ils sont visibles. */
  contacts: Record<string, { name: string } | null>;
}

export async function agentCenterData(ctx: AgencyContext) {
  return withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) => {
    const settings = new Map(
      (await c.query<{ agent_id: string; enabled: boolean }>("SELECT agent_id, enabled FROM app.agent_settings")).rows.map((r) => [r.agent_id, r.enabled]),
    );
    const missions = (await c.query<MissionRow>("SELECT * FROM app.missions ORDER BY started_at DESC LIMIT 30")).rows;
    const pending = (await c.query<{ agent_id: string; n: number }>(
      "SELECT agent_id, count(*)::int AS n FROM app.approvals WHERE status = 'en_attente' AND expires_at > now() GROUP BY 1",
    )).rows;
    // Biens et contacts visibles : sans eux, les agents n'ont rien à traiter (on le dit clairement).
    const material = (await c.query<{ biens: number; contacts: number }>(
      "SELECT (SELECT count(*)::int FROM app.properties) AS biens, (SELECT count(*)::int FROM app.contacts) AS contacts",
    )).rows[0] ?? { biens: 0, contacts: 0 };
    return { settings, missions, pending: new Map(pending.map((p) => [p.agent_id, p.n])), material };
  });
}

export async function listApprovals(ctx: AgencyContext): Promise<ApprovalRow[]> {
  return withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) => {
    const rows = (await c.query<Omit<ApprovalRow, "contacts">>(
      `SELECT *, CASE WHEN status = 'en_attente' AND expires_at <= now() THEN 'expiree' ELSE status END AS status
       FROM app.approvals ORDER BY (status = 'en_attente') DESC, created_at DESC LIMIT 100`,
    )).rows;
    const ids = [...new Set(rows.flatMap((r) => [r.payload.keepId, r.payload.removeId]).filter((x): x is string => typeof x === "string"))];
    const visible = new Map(
      (await c.query("SELECT id, first_name, last_name FROM app.contacts WHERE id = ANY($1)", [ids])).rows.map((r) => [r.id as string, contactName(r)]),
    );
    return rows.map((r) => ({
      ...r,
      contacts: Object.fromEntries(
        ["keepId", "removeId"].map((k) => {
          const id = r.payload[k];
          return [k, typeof id === "string" && visible.has(id) ? { name: visible.get(id)! } : null];
        }),
      ),
    }));
  });
}
