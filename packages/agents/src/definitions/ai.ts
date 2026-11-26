/**
 * Agents assistés par l'IA (D-069). Le code décide de tout (quoi traiter, combien, dans quel
 * ordre) ; l'IA ne fait que rédiger ou analyser, à partir des seules données des biens et du
 * marché (jamais de nom ni de coordonnées de contact). Chaque passage traite au plus 5 éléments
 * et ne refait pas un travail déjà fait ; un quota ou un plafond atteint arrête l'agent net.
 * Une annonce rédigée n'est jamais appliquée sans approbation (L2).
 */
import { z } from "zod";
import type { AgentDefinition, Gateway, MissionSummary } from "../core";

const noInput = z.object({}).strict();
/** Nombre maximal d'éléments traités par l'IA à chaque passage (coût maîtrisé). */
export const AI_ITEMS_PER_RUN = 5;

/** Réponse d'un outil d'IA : texte produit, ou raison du refus (« stop » : inutile de continuer). */
export type AiToolResult<T> = ({ ok: true } & T) | { ok: false; reason: string; stop: boolean };

export interface PropertyCandidate {
  propertyId: string;
  ownerUserId: string;
  label: string;
}
export interface FollowupCandidate {
  taskId: string;
  propertyId: string;
}

/** Boucle commune : l'IA produit, puis l'action est écrite ; arrêt au premier refus bloquant. */
async function forEachWithAi<C, T>(
  gateway: Gateway,
  items: readonly C[],
  produce: (item: C) => Promise<AiToolResult<T> | null>,
  write: (item: C, result: { ok: true } & T) => Promise<boolean>,
): Promise<{ done: number; skipped: number; stopReason: string | null }> {
  let done = 0;
  let skipped = 0;
  for (const item of items.slice(0, AI_ITEMS_PER_RUN)) {
    const r = await produce(item);
    if (!r) break;
    if (!r.ok) {
      if (r.stop) return { done, skipped, stopReason: r.reason };
      skipped += 1;
      continue;
    }
    if (await write(item, r)) done += 1;
  }
  void gateway;
  return { done, skipped, stopReason: null };
}

const stopped = (reason: string | null) => (reason ? ` Arrêt : ${reason}` : "");

export const listingWriterAgent: AgentDefinition<Record<string, never>> = {
  id: "listing-writer",
  version: "1.0.0",
  name: "Rédacteur d'annonces",
  department: "annonces",
  mode: "assiste",
  description: "Rédige le titre et le texte des annonces des biens en vente qui n'en ont pas encore, à partir de leurs caractéristiques. Chaque annonce attend votre approbation avant d'être enregistrée.",
  tools: ["listings.needingText", "ai.writeListing", "listing.applyDraft"],
  maxPermission: "L2",
  budget: { maxSteps: 1 + AI_ITEMS_PER_RUN * 2 },
  input: noInput,
  async run(gateway): Promise<MissionSummary> {
    const r = await gateway.call<PropertyCandidate[]>("listings.needingText", {});
    if (r.status !== "ok") throw new Error("Biens indisponibles.");
    let proposed = 0;
    const res = await forEachWithAi<PropertyCandidate, { title: string; description: string }>(
      gateway,
      r.result,
      async (p) => {
        const a = await gateway.call<AiToolResult<{ title: string; description: string }>>("ai.writeListing", { propertyId: p.propertyId });
        return a.status === "ok" ? a.result : null;
      },
      async (p, draft) => {
        const m = await gateway.call("listing.applyDraft", { propertyId: p.propertyId, title: draft.title, description: draft.description });
        if (m.status === "approbation_demandee") proposed += 1;
        return m.status === "approbation_demandee";
      },
    );
    return {
      text: `${r.result.length} bien(s) sans annonce, ${proposed} annonce(s) rédigée(s) et proposée(s) à l'approbation.${stopped(res.stopReason)}`,
      counts: { biens: r.result.length, propositions: proposed, ignores: res.skipped },
    };
  },
};

export const listingAnalystAgent: AgentDefinition<Record<string, never>> = {
  id: "listing-analyst",
  version: "1.0.0",
  name: "Analyse des annonces",
  department: "annonces",
  mode: "assiste",
  description: "Analyse chaque bien en vente : points forts, points faibles, prix comparé aux ventes réelles du quartier (DVF) et conseils pour mieux vendre. L'analyse arrive au responsable sous forme de tâche, une seule fois par prix.",
  tools: ["analysis.candidates", "ai.analyzeListing", "tasks.createAnalysis"],
  maxPermission: "L1",
  budget: { maxSteps: 1 + AI_ITEMS_PER_RUN * 2 },
  input: noInput,
  async run(gateway): Promise<MissionSummary> {
    const r = await gateway.call<PropertyCandidate[]>("analysis.candidates", {});
    if (r.status !== "ok") throw new Error("Biens indisponibles.");
    const res = await forEachWithAi<PropertyCandidate, { analysis: string; verdict: string }>(
      gateway,
      r.result,
      async (p) => {
        const a = await gateway.call<AiToolResult<{ analysis: string; verdict: string }>>("ai.analyzeListing", { propertyId: p.propertyId });
        return a.status === "ok" ? a.result : null;
      },
      async (p, a) => {
        const t = await gateway.call<{ created: boolean }>("tasks.createAnalysis", {
          propertyId: p.propertyId, assigneeUserId: p.ownerUserId,
          title: `Analyse de l'annonce (${a.verdict}) : ${p.label}`.slice(0, 200), details: a.analysis,
        });
        return t.status === "ok" && t.result.created;
      },
    );
    return {
      text: `${r.result.length} bien(s) à analyser, ${res.done} analyse(s) envoyée(s) aux responsables.${stopped(res.stopReason)}`,
      counts: { biens: r.result.length, analyses: res.done, ignores: res.skipped },
    };
  },
};

export const followupWriterAgent: AgentDefinition<Record<string, never>> = {
  id: "followup-writer",
  version: "1.0.0",
  name: "Relances",
  department: "matching",
  mode: "assiste",
  description: "Pour chaque alerte « bien correspondant » à traiter, prépare le message à envoyer à l'acquéreur pour lui présenter le bien. Le message reste dans la tâche, prêt à copier : rien n'est envoyé.",
  tools: ["followups.candidates", "ai.buyerMessage", "tasks.attachMessage"],
  maxPermission: "L1",
  budget: { maxSteps: 1 + AI_ITEMS_PER_RUN * 2 },
  input: noInput,
  async run(gateway): Promise<MissionSummary> {
    const r = await gateway.call<FollowupCandidate[]>("followups.candidates", {});
    if (r.status !== "ok") throw new Error("Tâches indisponibles.");
    const res = await forEachWithAi<FollowupCandidate, { message: string }>(
      gateway,
      r.result,
      async (f) => {
        const a = await gateway.call<AiToolResult<{ message: string }>>("ai.buyerMessage", { propertyId: f.propertyId });
        return a.status === "ok" ? a.result : null;
      },
      async (f, a) => {
        const t = await gateway.call<{ updated: boolean }>("tasks.attachMessage", { taskId: f.taskId, message: a.message });
        return t.status === "ok" && t.result.updated;
      },
    );
    return {
      text: `${r.result.length} alerte(s) à traiter, ${res.done} message(s) préparé(s) pour les acquéreurs.${stopped(res.stopReason)}`,
      counts: { alertes: r.result.length, messages: res.done, ignores: res.skipped },
    };
  },
};

export const AI_AGENTS = [listingWriterAgent, listingAnalystAgent, followupWriterAgent] as const;
