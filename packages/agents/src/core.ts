/**
 * Socle des agents (docs/phase-2/moteur-agents.md, docs/phase-2/permissions.md).
 *
 * - Fiches d'agents VERSIONNÉES DANS LE CODE : un agent ne peut pas changer ses propres règles.
 * - Passerelle d'outils, point de contrôle unique : outil dans la liste fermée de la fiche,
 *   niveau ≤ plafond de la fiche, entrée validée, budget d'étapes ; à partir de L2, l'action
 *   n'est PAS exécutée : une demande d'approbation est créée.
 * - L'exécution réelle (base, RLS) est fournie par l'application : ce module ne voit que des « ports ».
 */
import type { ZodType } from "zod";

export type PermissionLevel = "L0" | "L1" | "L2" | "L3";
export type AgentMode = "deterministe" | "assiste" | "autonome";

export const LEVEL_RANK: Record<PermissionLevel, number> = { L0: 0, L1: 1, L2: 2, L3: 3 };
export const LEVEL_LABELS: Record<PermissionLevel, string> = {
  L0: "Lecture",
  L1: "Écriture interne réversible",
  L2: "Modification importante (approbation)",
  L3: "Action externe ou irréversible (approbation à chaque fois)",
};

export interface ToolDefinition<I = unknown, O = unknown> {
  id: string;
  level: PermissionLevel;
  description: string;
  input: ZodType<I>;
  /** Exécution avec l'identité de l'utilisateur (la RLS s'applique). Jamais appelée directement par un agent pour L2+. */
  run(input: I): Promise<O>;
  /** Titre lisible d'une demande d'approbation (L2+), sans donnée personnelle. */
  approvalTitle?(input: I): string;
}

export interface AgentDefinition<I = unknown> {
  id: string;
  version: string;
  name: string;
  department: string;
  mode: AgentMode;
  description: string;
  tools: readonly string[];
  maxPermission: PermissionLevel;
  budget: { maxSteps: number };
  /** Validation de l'entrée de mission. */
  input: ZodType<I>;
  run(gateway: Gateway, input: I): Promise<MissionSummary>;
}

/** Résumé de mission : des nombres et des libellés, jamais de données personnelles. */
export type MissionSummary = { text: string; counts?: Record<string, number> };

export type StepStatus = "ok" | "refuse" | "approbation";

export interface StepRecord {
  position: number;
  tool: string;
  level: PermissionLevel;
  status: StepStatus;
  durationMs: number;
  detail: Record<string, unknown>;
}

export interface MissionPorts {
  recordStep(step: StepRecord): Promise<void>;
  requestApproval(request: { tool: string; level: PermissionLevel; title: string; payload: unknown }): Promise<string>;
}

export class GatewayError extends Error {
  constructor(
    readonly code: "outil_non_autorise" | "niveau_trop_eleve" | "budget_depasse" | "entree_invalide" | "outil_inconnu",
    message: string,
  ) {
    super(message);
  }
}

export type CallResult<O> = { status: "ok"; result: O } | { status: "approbation_demandee"; approvalId: string };

export interface Gateway {
  call<O = unknown>(toolId: string, input: unknown): Promise<CallResult<O>>;
  readonly approvals: string[];
  readonly steps: number;
}

/** Passerelle d'outils : le SEUL chemin par lequel un agent agit. */
export function createGateway(agent: AgentDefinition<never>, tools: ReadonlyMap<string, ToolDefinition<never, unknown>>, ports: MissionPorts): Gateway {
  let steps = 0;
  const approvals: string[] = [];
  const refuse = async (toolId: string, level: PermissionLevel, error: GatewayError) => {
    await ports.recordStep({ position: steps, tool: toolId, level, status: "refuse", durationMs: 0, detail: { code: error.code } });
    throw error;
  };

  return {
    get approvals() {
      return approvals;
    },
    get steps() {
      return steps;
    },
    async call<O>(toolId: string, rawInput: unknown): Promise<CallResult<O>> {
      steps += 1;
      const tool = tools.get(toolId) as ToolDefinition<unknown, O> | undefined;
      if (!tool) return refuse(toolId, "L0", new GatewayError("outil_inconnu", `Outil inconnu : ${toolId}.`));
      if (!agent.tools.includes(toolId)) {
        return refuse(toolId, tool.level, new GatewayError("outil_non_autorise", `L'agent ${agent.id} n'a pas le droit d'utiliser ${toolId}.`));
      }
      if (LEVEL_RANK[tool.level] > LEVEL_RANK[agent.maxPermission]) {
        return refuse(toolId, tool.level, new GatewayError("niveau_trop_eleve", `${toolId} (${tool.level}) dépasse le plafond de l'agent (${agent.maxPermission}).`));
      }
      if (steps > agent.budget.maxSteps) {
        return refuse(toolId, tool.level, new GatewayError("budget_depasse", `Budget de ${agent.budget.maxSteps} étapes dépassé.`));
      }
      const parsed = tool.input.safeParse(rawInput);
      if (!parsed.success) return refuse(toolId, tool.level, new GatewayError("entree_invalide", `Entrée invalide pour ${toolId}.`));

      if (LEVEL_RANK[tool.level] >= LEVEL_RANK.L2) {
        const approvalId = await ports.requestApproval({
          tool: toolId,
          level: tool.level,
          title: tool.approvalTitle?.(parsed.data) ?? tool.description,
          payload: parsed.data,
        });
        approvals.push(approvalId);
        await ports.recordStep({ position: steps, tool: toolId, level: tool.level, status: "approbation", durationMs: 0, detail: { approvalId } });
        return { status: "approbation_demandee", approvalId };
      }

      const started = Date.now();
      const result = await tool.run(parsed.data);
      await ports.recordStep({ position: steps, tool: toolId, level: tool.level, status: "ok", durationMs: Date.now() - started, detail: {} });
      return { status: "ok", result };
    },
  };
}

export type MissionOutcome =
  | { status: "reussie"; summary: MissionSummary; steps: number }
  | { status: "attente_approbation"; summary: MissionSummary; steps: number; approvals: string[] }
  | { status: "echouee"; error: string; steps: number };

/** Exécute une mission (mode déterministe : aucune IA, coût nul). */
export async function runMission<I>(
  agent: AgentDefinition<I>,
  tools: ReadonlyMap<string, ToolDefinition<never, unknown>>,
  ports: MissionPorts,
  rawInput: unknown,
): Promise<MissionOutcome> {
  const input = agent.input.safeParse(rawInput);
  if (!input.success) return { status: "echouee", error: "Entrée de mission invalide.", steps: 0 };
  const gateway = createGateway(agent as AgentDefinition<never>, tools, ports);
  try {
    const summary = await agent.run(gateway, input.data);
    return gateway.approvals.length
      ? { status: "attente_approbation", summary, steps: gateway.steps, approvals: gateway.approvals }
      : { status: "reussie", summary, steps: gateway.steps };
  } catch (e) {
    return { status: "echouee", error: e instanceof Error ? e.message : "Erreur inconnue.", steps: gateway.steps };
  }
}
