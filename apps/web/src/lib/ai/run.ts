/**
 * Appel à l'IA commun à l'assistant et aux agents (D-063, D-065, D-069) : vérifie l'IA, le rôle,
 * le quota de la formule (ou les crédits à l'usage) et le plafond global ; appelle le modèle ;
 * enregistre l'appel (jetons, coût, prix facturé) sans jamais garder le texte.
 */
import Anthropic from "@anthropic-ai/sdk";
import { withTenant } from "@immopilot/db";
import { aiCostMicroUsd, aiDecision, AI_GATE_MESSAGES, OVERAGE_UNIT_CENTS, parisMonthStart, type AiDecision, type AiGateReason } from "@immopilot/domain";
import type { AgencyContext } from "../agency/context";
import { overageState } from "../billing/overage";
import { agencyPlanAndUsage, quotaFor } from "../billing/plan";
import { getTenantPool } from "../server/db";
import { aiConfig } from "./config";

export type AiFeature = "copilot" | "annonce";
const METRIC = { copilot: "copilot", annonce: "annonces_ia" } as const;

/** L'IA peut-elle être appelée pour cette fonction, et l'appel sera-t-il facturé à l'usage ? */
export async function aiDecisionFor(ctx: AgencyContext, feature: AiFeature): Promise<AiDecision> {
  const config = aiConfig();
  if (!config.enabled) return { reason: "desactivee", overage: false };
  const metric = METRIC[feature];
  const [{ current, usage }, overage] = await Promise.all([agencyPlanAndUsage(ctx), overageState(ctx)]);
  const check = quotaFor(current, usage, metric, 0);
  const budgetLeft = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    (await c.query<{ ok: boolean }>("SELECT app.ai_budget_left($1, $2) AS ok", [parisMonthStart(new Date()), config.monthlyBudgetMicroUsd])).rows[0]?.ok ?? false);
  return aiDecision({
    enabled: true, role: ctx.role, limit: check.limit, used: check.used, budgetLeft,
    overage: { billable: overage.billable, capCents: overage.capCents, spentCents: overage.month.cents, unitCents: OVERAGE_UNIT_CENTS[metric] },
  });
}

let client: Anthropic | null = null;
export const anthropic = () => (client ??= new Anthropic());

/** Enregistre un appel : jetons et coût seulement, jamais le texte. */
export async function recordAiRun(ctx: AgencyContext, run: {
  feature: AiFeature; model: string; status: "ok" | "refus" | "erreur"; inputTokens: number; outputTokens: number; overage: boolean;
}): Promise<number> {
  const cost = aiCostMicroUsd(run.model, run.inputTokens, run.outputTokens);
  await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, (_db, c) =>
    c.query(
      `INSERT INTO app.ai_runs (org_id, user_id, feature, model, status, input_tokens, output_tokens, cost_microusd, overage_cents)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [ctx.org.id, ctx.user.id, run.feature, run.model, run.status, run.inputTokens, run.outputTokens, cost,
       run.overage && run.status === "ok" ? OVERAGE_UNIT_CENTS[METRIC[run.feature]] : 0],
    ));
  return cost;
}

export type AiTextResult = { ok: true; text: string; costMicroUsd: number } | { ok: false; reason: AiGateReason | "erreur" | "refus"; message: string };

/** Une demande d'écriture courte (agents) : un seul appel, réponse en texte. */
export async function aiText(ctx: AgencyContext, input: { feature: AiFeature; system: string; prompt: string; maxTokens: number }): Promise<AiTextResult> {
  const decision = await aiDecisionFor(ctx, input.feature);
  if (decision.reason) return { ok: false, reason: decision.reason, message: AI_GATE_MESSAGES[decision.reason] };
  const config = aiConfig();
  let status: "ok" | "refus" | "erreur" = "erreur";
  let inputTokens = 0;
  let outputTokens = 0;
  let text = "";
  try {
    const response = await anthropic().messages.create({
      model: config.model,
      max_tokens: input.maxTokens,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
    });
    inputTokens = response.usage.input_tokens + (response.usage.cache_creation_input_tokens ?? 0) + (response.usage.cache_read_input_tokens ?? 0);
    outputTokens = response.usage.output_tokens;
    if (response.stop_reason === "refusal") status = "refus";
    else {
      text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      status = text ? "ok" : "erreur";
    }
  } catch (error) {
    if (!(error instanceof Anthropic.APIError)) throw error;
  }
  const costMicroUsd = await recordAiRun(ctx, { feature: input.feature, model: config.model, status, inputTokens, outputTokens, overage: decision.overage });
  if (status === "ok") return { ok: true, text, costMicroUsd };
  return status === "refus"
    ? { ok: false, reason: "refus", message: "L'IA a refusé cette demande." }
    : { ok: false, reason: "erreur", message: "L'IA n'a pas pu répondre. Réessayez plus tard." };
}

/** Raisons qui rendent inutile de continuer une mission (toutes les suivantes échoueraient aussi). */
export const STOP_REASONS = new Set<AiGateReason | "erreur" | "refus">(["desactivee", "lecture_seule", "non_inclus", "quota_atteint", "plafond_atteint", "budget_atteint", "erreur"]);
