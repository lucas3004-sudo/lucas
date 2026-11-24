"use server";
/**
 * Lancement des missions, activation des agents, décisions d'approbation.
 * Une mission s'exécute avec l'identité de l'utilisateur qui la lance (la RLS s'applique) ;
 * une action approuvée s'exécute avec l'identité de celui qui l'approuve.
 */
import { AGENTS_BY_ID } from "@immopilot/agents";
import { withTenant } from "@immopilot/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAgency } from "../agency/context";
import { audit } from "../audit";
import { getTenantPool } from "../server/db";
import { MergeError, mergeContacts } from "./merge";
import { runAgentMission } from "./run";

export async function runAgentAction(form: FormData): Promise<void> {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") return;
  const agent = AGENTS_BY_ID.get(z.string().parse(form.get("agentId")));
  if (!agent) return;
  await runAgentMission(ctx, agent, "manuel");
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
