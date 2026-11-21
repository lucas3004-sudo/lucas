"use server";
/**
 * Lancement des missions, activation des agents, décisions d'approbation.
 * Une mission s'exécute avec l'identité de l'utilisateur qui la lance (la RLS s'applique) ;
 * une action approuvée s'exécute avec l'identité de celui qui l'approuve.
 */
import { AGENTS_BY_ID, runMission, type MissionPorts } from "@immopilot/agents";
import { withTenant } from "@immopilot/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAgency } from "../agency/context";
import { audit } from "../audit";
import { getTenantPool } from "../server/db";
import { MergeError, mergeContacts } from "./merge";
import { buildTools } from "./tools";

export async function runAgentAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") return;
  const agent = AGENTS_BY_ID.get(z.string().parse(form.get("agentId")));
  if (!agent) return;
  const tenant = { orgId: ctx.org.id, userId: ctx.user.id };
  const pool = getTenantPool();

  const missionId = await withTenant(pool, tenant, async (_db, c) => {
    const setting = (await c.query<{ enabled: boolean }>("SELECT enabled FROM app.agent_settings WHERE agent_id = $1", [agent.id])).rows[0];
    if (setting && !setting.enabled) return null;
    return (await c.query<{ id: string }>(
      "INSERT INTO app.missions (org_id, agent_id, agent_version, requested_by) VALUES ($1, $2, $3, $4) RETURNING id",
      [ctx.org.id, agent.id, agent.version, ctx.user.id],
    )).rows[0]!.id;
  });
  if (!missionId) return;

  const ports: MissionPorts = {
    recordStep: (s) =>
      withTenant(pool, tenant, (_db, c) =>
        c.query(
          `INSERT INTO app.mission_steps (org_id, mission_id, position, tool, level, status, duration_ms, detail) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [ctx.org.id, missionId, s.position, s.tool, s.level, s.status, s.durationMs, s.detail],
        )).then(() => undefined),
    requestApproval: (r) =>
      withTenant(pool, tenant, async (_db, c) =>
        (await c.query<{ id: string }>(
          `INSERT INTO app.approvals (org_id, mission_id, agent_id, tool, level, title, payload, requested_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [ctx.org.id, missionId, agent.id, r.tool, r.level, r.title.slice(0, 300), JSON.stringify(r.payload), ctx.user.id],
        )).rows[0]!.id),
  };

  const outcome = await runMission(agent, buildTools(ctx), ports, {});
  await withTenant(pool, tenant, (_db, c) =>
    c.query(
      `UPDATE app.missions SET status = $2, summary = $3, error = $4, steps = $5, finished_at = now() WHERE id = $1`,
      [missionId, outcome.status, outcome.status === "echouee" ? {} : outcome.summary, outcome.status === "echouee" ? outcome.error.slice(0, 500) : null, outcome.steps],
    ));
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "agent.mission", targetType: "mission", targetId: missionId, details: { agent: agent.id, statut: outcome.status } });
  revalidatePath("/app/agents");
}

export async function setAgentEnabledAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  if (ctx.role !== "gerant") return;
  const agentId = z.string().parse(form.get("agentId"));
  if (!AGENTS_BY_ID.has(agentId)) return;
  const enabled = form.get("enabled") === "1";
  await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, (_db, c) =>
    c.query(
      `INSERT INTO app.agent_settings (org_id, agent_id, enabled, updated_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (org_id, agent_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [ctx.org.id, agentId, enabled, ctx.user.id],
    ));
  await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "agent.reglage", details: { agent: agentId, actif: enabled } });
  revalidatePath("/app/agents");
}

/** Exécuteurs des actions soumises à approbation, dans la transaction de la décision. */
const EXECUTORS = {
  "contacts.merge": async (c: Parameters<typeof mergeContacts>[0], ctx: Parameters<typeof mergeContacts>[1], payload: unknown) =>
    mergeContacts(c, ctx, z.object({ keepId: z.uuid(), removeId: z.uuid() }).parse(payload)),
} as const;

export async function decideApprovalAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  const id = z.uuid().parse(form.get("id"));
  const approve = form.get("decision") === "approuver";
  const tenant = { orgId: ctx.org.id, userId: ctx.user.id };
  const pool = getTenantPool();

  let outcome: "approuvee" | "refusee" | "echouee" | null = null;
  let errorMessage: string | null = null;
  try {
    outcome = await withTenant(pool, tenant, async (_db, c) => {
      // Verrouille la demande : une seule décision, jamais deux exécutions.
      const row = (await c.query<{ tool: string; payload: unknown }>(
        "SELECT tool, payload FROM app.approvals WHERE id = $1 AND status = 'en_attente' AND expires_at > now() FOR UPDATE",
        [id],
      )).rows[0];
      if (!row) return null;
      let result: unknown = null;
      if (approve) {
        const executor = EXECUTORS[row.tool as keyof typeof EXECUTORS];
        if (!executor) throw new MergeError("Action inconnue.");
        result = await executor(c, ctx, row.payload);
      }
      const updated = await c.query(
        "UPDATE app.approvals SET status = $2, decided_by = $3, decided_at = now(), result = $4 WHERE id = $1",
        [id, approve ? "approuvee" : "refusee", ctx.user.id, result === null ? null : JSON.stringify(result)],
      );
      if (!updated.rowCount) throw new MergeError("Vous n'êtes pas habilité à décider de cette demande.");
      return approve ? "approuvee" : "refusee";
    });
  } catch (e) {
    if (!(e instanceof MergeError) && (e as { code?: string }).code !== "42501") throw e;
    errorMessage = e instanceof MergeError ? e.message : "Action refusée par les règles d'accès.";
    // La transaction a été annulée : on enregistre l'échec (la demande est encore « en attente »).
    const marked = await withTenant(pool, tenant, async (_db, c) =>
      (await c.query(
        "UPDATE app.approvals SET status = 'echouee', decided_by = $2, decided_at = now(), result = $3 WHERE id = $1 AND status = 'en_attente'",
        [id, ctx.user.id, JSON.stringify({ erreur: errorMessage })],
      )).rowCount ?? 0);
    outcome = marked ? "echouee" : null;
  }
  if (outcome) {
    await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "approbation.decidee", targetType: "approbation", targetId: id, details: { decision: outcome } });
  }
  revalidatePath("/app/agents");
  revalidatePath("/app/agents/approbations");
  revalidatePath("/app/contacts");
}
