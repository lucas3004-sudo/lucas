/**
 * Exécution d'une mission d'agent (D-044) et passage automatique quotidien (D-064).
 * Une mission s'exécute avec l'identité de l'utilisateur concerné : la RLS s'applique, l'agent ne
 * voit et ne fait que ce que cet utilisateur peut voir et faire.
 */
import { AGENTS, runMission, type AgentDefinition, type MissionPorts } from "@immopilot/agents";
import { withTenant } from "@immopilot/db";
import { utcToParisLocal } from "@immopilot/domain";
import type { AgencyContext } from "../agency/context";
import { audit } from "../audit";
import { getTenantPool } from "../server/db";
import { aiConfig } from "../ai/config";
import type { AiMeter } from "./ai-tools";
import { buildTools } from "./tools";

type Trigger = "manuel" | "auto";

/** Crée la mission puis l'exécute. Renvoie null si l'agent est désactivé ou déjà passé aujourd'hui (auto). */
export async function runAgentMission(ctx: AgencyContext, agent: AgentDefinition<Record<string, never>>, trigger: Trigger): Promise<string | null> {
  if (ctx.role === "lecture") return null;
  const tenant = { orgId: ctx.org.id, userId: ctx.user.id };
  const pool = getTenantPool();
  const today = utcToParisLocal(new Date()).slice(0, 10);

  const missionId = await withTenant(pool, tenant, async (_db, c) => {
    const setting = (await c.query<{ enabled: boolean }>("SELECT enabled FROM app.agent_settings WHERE agent_id = $1", [agent.id])).rows[0];
    if (setting && !setting.enabled) return null;
    // Passage automatique : une seule mission par agent, par utilisateur et par jour (index unique).
    return (await c.query<{ id: string }>(
      `INSERT INTO app.missions (org_id, agent_id, agent_version, requested_by, trigger, run_on) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (org_id, agent_id, requested_by, run_on) WHERE trigger = 'auto' DO NOTHING RETURNING id`,
      [ctx.org.id, agent.id, agent.version, ctx.user.id, trigger, trigger === "auto" ? today : null],
    )).rows[0]?.id ?? null;
  });
  if (!missionId) return null;

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

  const meter: AiMeter = { costMicroUsd: 0 };
  const outcome = await runMission(agent, buildTools(ctx, meter), ports, {});
  await withTenant(pool, tenant, (_db, c) =>
    c.query(
      `UPDATE app.missions SET status = $2, summary = $3, error = $4, steps = $5, cost_micro_usd = $6, finished_at = now() WHERE id = $1`,
      [missionId, outcome.status, outcome.status === "echouee" ? {} : outcome.summary, outcome.status === "echouee" ? outcome.error.slice(0, 500) : null, outcome.steps, Math.round(meter.costMicroUsd)],
    ));
  await audit({
    orgId: ctx.org.id, userId: ctx.user.id, action: "agent.mission", targetType: "mission", targetId: missionId,
    details: { agent: agent.id, statut: outcome.status, ...(trigger === "auto" ? { automatique: true } : {}) },
  });
  return missionId;
}

/**
 * Passage automatique du jour : lancé après l'affichage de la page (jamais pendant), une fois par
 * jour et par utilisateur. Les agents déterministes ne coûtent rien ; les agents assistés par l'IA
 * traitent au plus 5 éléments chacun, dans la limite des quotas et du plafond (D-069).
 */
export async function runDailyAgents(ctx: AgencyContext): Promise<void> {
  if (ctx.role === "lecture") return;
  const today = utcToParisLocal(new Date()).slice(0, 10);
  const done = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    new Set((await c.query<{ agent_id: string }>(
      "SELECT agent_id FROM app.missions WHERE trigger = 'auto' AND run_on = $1 AND requested_by = $2", [today, ctx.user.id],
    )).rows.map((r) => r.agent_id)));
  const aiOn = aiConfig().enabled;
  for (const agent of AGENTS) {
    if (done.has(agent.id)) continue;
    // Les agents assistés par l'IA ne passent que si l'IA est activée (D-069).
    if (agent.mode !== "deterministe" && !aiOn) continue;
    try {
      await runAgentMission(ctx, agent, "auto");
    } catch (error) {
      // Un agent en échec ne doit ni bloquer les autres ni casser la page.
      console.error(`Passage automatique de l'agent ${agent.id} impossible`, error);
    }
  }
}
