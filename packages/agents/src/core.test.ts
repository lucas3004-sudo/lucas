import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createGateway, GatewayError, runMission, type AgentDefinition, type MissionPorts, type StepRecord, type ToolDefinition } from "./core";
import { AGENTS, AI_AGENTS, AI_ITEMS_PER_RUN, deadlineWatcherAgent, duplicateDetectionAgent, followupWriterAgent, listingWriterAgent, mandateWatcherAgent, listingAnalystAgent } from "./definitions";

function harness() {
  const steps: StepRecord[] = [];
  const approvals: Array<{ tool: string; title: string; payload: unknown }> = [];
  const ports: MissionPorts = {
    async recordStep(s) {
      steps.push(s);
    },
    async requestApproval(r) {
      approvals.push(r);
      return `appr-${approvals.length}`;
    },
  };
  return { steps, approvals, ports };
}

const executed: string[] = [];
const tool = (id: string, level: ToolDefinition["level"], result: unknown = {}): ToolDefinition<never, unknown> =>
  ({
    id,
    level,
    description: id,
    input: z.object({ n: z.number().optional() }).passthrough(),
    approvalTitle: () => `Approuver ${id}`,
    async run() {
      executed.push(id);
      return result;
    },
  }) as unknown as ToolDefinition<never, unknown>;

const tools = new Map([
  ["read", tool("read", "L0", [1, 2])],
  ["write", tool("write", "L1", { created: true })],
  ["merge", tool("merge", "L2")],
  ["send", tool("send", "L3")],
]);

const agent = (over: Partial<AgentDefinition<never>> = {}): AgentDefinition<never> => ({
  id: "test",
  version: "1.0.0",
  name: "Test",
  department: "test",
  mode: "deterministe",
  description: "",
  tools: ["read", "write", "merge", "send"],
  maxPermission: "L3",
  budget: { maxSteps: 5 },
  input: z.object({}) as never,
  run: async () => ({ text: "" }),
  ...over,
});

describe("passerelle d'outils", () => {
  it("exécute un outil L0 ou L1 autorisé et journalise l'étape", async () => {
    const h = harness();
    const g = createGateway(agent(), tools, h.ports);
    expect(await g.call("read", {})).toEqual({ status: "ok", result: [1, 2] });
    expect(h.steps).toEqual([expect.objectContaining({ position: 1, tool: "read", level: "L0", status: "ok" })]);
  });

  it("refuse un outil absent de la fiche, même s'il existe", async () => {
    const h = harness();
    const g = createGateway(agent({ tools: ["read"] }), tools, h.ports);
    await expect(g.call("write", {})).rejects.toMatchObject({ code: "outil_non_autorise" });
    expect(h.steps[0]).toMatchObject({ tool: "write", status: "refuse" });
  });

  it("refuse un outil au-dessus du plafond de l'agent", async () => {
    const g = createGateway(agent({ maxPermission: "L1" }), tools, harness().ports);
    await expect(g.call("merge", {})).rejects.toBeInstanceOf(GatewayError);
    await expect(g.call("merge", {})).rejects.toMatchObject({ code: "niveau_trop_eleve" });
  });

  it("à partir de L2 : aucune exécution, une demande d'approbation est créée", async () => {
    const h = harness();
    executed.length = 0;
    const g = createGateway(agent(), tools, h.ports);
    expect(await g.call("merge", { n: 1 })).toEqual({ status: "approbation_demandee", approvalId: "appr-1" });
    expect(await g.call("send", {})).toEqual({ status: "approbation_demandee", approvalId: "appr-2" });
    expect(executed).toEqual([]);
    expect(h.approvals.map((a) => a.title)).toEqual(["Approuver merge", "Approuver send"]);
    expect(g.approvals).toEqual(["appr-1", "appr-2"]);
  });

  it("arrête l'agent au-delà de son budget d'étapes ; refuse une entrée invalide", async () => {
    const g = createGateway(agent({ budget: { maxSteps: 2 } }), tools, harness().ports);
    await g.call("read", {});
    await g.call("read", {});
    await expect(g.call("read", {})).rejects.toMatchObject({ code: "budget_depasse" });
    const g2 = createGateway(agent(), tools, harness().ports);
    await expect(g2.call("read", { n: "pas un nombre" })).rejects.toMatchObject({ code: "entree_invalide" });
    await expect(g2.call("inconnu", {})).rejects.toMatchObject({ code: "outil_inconnu" });
  });
});

describe("missions", () => {
  it("réussie, en attente d'approbation ou échouée selon le déroulé", async () => {
    const ok = await runMission(agent({ run: async (g) => (await g.call("read", {}), { text: "fini" }) }), tools, harness().ports, {});
    expect(ok).toEqual({ status: "reussie", summary: { text: "fini" }, steps: 1 });
    const pending = await runMission(agent({ run: async (g) => (await g.call("merge", {}), { text: "proposé" }) }), tools, harness().ports, {});
    expect(pending).toMatchObject({ status: "attente_approbation", approvals: ["appr-1"] });
    const failed = await runMission(agent({ tools: [], run: async (g) => (await g.call("read", {}), { text: "" }) }), tools, harness().ports, {});
    expect(failed).toMatchObject({ status: "echouee", steps: 1 });
  });
});

describe("fiches des agents", () => {
  it("chaque fiche est complète ; les agents d'origine sont déterministes, les agents IA « assistés » (D-069)", () => {
    for (const a of AGENTS) {
      expect(a.id).toMatch(/^[a-z-]+$/);
      expect(a.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(a.mode).toBe(AI_AGENTS.some((x) => x.id === a.id) ? "assiste" : "deterministe");
      expect(a.tools.length).toBeGreaterThan(0);
    }
    // Aucun agent IA n'agit à l'extérieur (L3) ; seule l'annonce rédigée demande une approbation.
    expect(AI_AGENTS.map((a) => a.maxPermission)).toEqual(["L2", "L1", "L1"]);
    expect(new Set(AGENTS.map((a) => a.id)).size).toBe(AGENTS.length);
    // Les rappels d'échéances n'ont pas besoin d'approbation ; la fusion de doublons, si (L2).
    expect(deadlineWatcherAgent.maxPermission).toBe("L1");
    expect(mandateWatcherAgent.maxPermission).toBe("L1");
    expect(duplicateDetectionAgent.maxPermission).toBe("L2");
  });

  it("l'agent des doublons propose une fusion par contact en double, sans jamais fusionner lui-même", async () => {
    const h = harness();
    executed.length = 0;
    const appTools = new Map<string, ToolDefinition<never, unknown>>([
      ["contacts.duplicates", tool("contacts.duplicates", "L0", [{ reason: "email", ids: ["a", "b", "c"] }])],
      ["contacts.merge", { ...tool("contacts.merge", "L2"), input: z.object({ keepId: z.string(), removeId: z.string(), reason: z.string() }) } as never],
    ]);
    const outcome = await runMission(duplicateDetectionAgent, appTools, h.ports, {});
    expect(outcome).toMatchObject({ status: "attente_approbation", summary: { counts: { groupes: 1, propositions: 2 } } });
    expect(h.approvals.map((a) => a.payload)).toEqual([
      { keepId: "a", removeId: "b", reason: "email" },
      { keepId: "a", removeId: "c", reason: "email" },
    ]);
    expect(executed).toEqual(["contacts.duplicates"]);
  });

  it("la veille des mandats crée un rappel par mandat proche ou expiré, pour le responsable du bien", async () => {
    const h = harness();
    executed.length = 0;
    const reminders: unknown[] = [];
    const appTools = new Map<string, ToolDefinition<never, unknown>>([
      ["mandates.expiring", tool("mandates.expiring", "L0", [
        { propertyId: "p1", ownerUserId: "u1", propertyLabel: "8 Boulevard du Port", mandateNumber: "M-42", endsOn: "2026-12-01", daysLeft: 10 },
        { propertyId: "p2", ownerUserId: "u2", propertyLabel: "2 Place Gambetta", mandateNumber: null, endsOn: "2026-11-19", daysLeft: -2 },
      ])],
      ["tasks.createMandateReminder", {
        ...tool("tasks.createMandateReminder", "L1"),
        input: z.object({ propertyId: z.string(), assigneeUserId: z.string(), title: z.string(), details: z.string(), dueOn: z.string() }),
        run: async (input: unknown) => (reminders.push(input), { created: true }),
      } as never],
    ]);
    const outcome = await runMission(mandateWatcherAgent, appTools, h.ports, {});
    expect(outcome).toMatchObject({ status: "reussie", summary: { counts: { mandats: 2, rappels: 2 } } });
    expect(reminders).toEqual([
      { propertyId: "p1", assigneeUserId: "u1", title: "Mandat à renouveler : 8 Boulevard du Port", dueOn: "2026-12-01",
        details: "Le mandat n° M-42 se termine dans 10 jour(s) (2026-12-01). Renouvelez-le avec le vendeur ou changez le statut du bien." },
      { propertyId: "p2", assigneeUserId: "u2", title: "Mandat à renouveler : 2 Place Gambetta", dueOn: "2026-11-19",
        details: "Le mandat a expiré il y a 2 jour(s) (2026-11-19). Renouvelez-le avec le vendeur ou changez le statut du bien." },
    ]);
  });
});

describe("agents assistés par l'IA (D-069)", () => {
  const candidates = Array.from({ length: 8 }, (_, i) => ({ propertyId: `p${i}`, ownerUserId: `u${i}`, label: `Bien ${i}`, taskId: `t${i}` }));
  const toolsFor = (ai: (i: number) => unknown) => {
    let n = 0;
    const calls: string[] = [];
    const mk = (id: string, level: ToolDefinition["level"], run: () => unknown) =>
      [id, { id, level, description: id, input: z.object({}).passthrough(), approvalTitle: () => id, run: async () => { calls.push(id); return run(); } }] as const;
    const map = new Map<string, ToolDefinition<never, unknown>>([
      mk("listings.needingText", "L0", () => candidates),
      mk("analysis.candidates", "L0", () => candidates),
      mk("followups.candidates", "L0", () => candidates),
      mk("ai.writeListing", "L0", () => ai(n++)),
      mk("ai.analyzeListing", "L0", () => ai(n++)),
      mk("ai.buyerMessage", "L0", () => ai(n++)),
      mk("listing.applyDraft", "L2", () => ({})),
      mk("tasks.createAnalysis", "L1", () => ({ created: true })),
      mk("tasks.attachMessage", "L1", () => ({ updated: true })),
    ] as unknown as [string, ToolDefinition<never, unknown>][]);
    return { map, calls };
  };
  const ok = { ok: true, title: "T", description: "D", analysis: "Analyse", verdict: "bien placé", message: "Bonjour [Prénom]" };

  it("rédacteur : 5 annonces au plus par passage, chacune soumise à approbation, jamais appliquée directement", async () => {
    const { ports, approvals } = harness();
    const { map, calls } = toolsFor(() => ok);
    const outcome = await runMission(listingWriterAgent, map, ports, {});
    expect(outcome.status).toBe("attente_approbation");
    expect(approvals).toHaveLength(AI_ITEMS_PER_RUN);
    expect(calls.filter((c) => c === "ai.writeListing")).toHaveLength(AI_ITEMS_PER_RUN);
    expect(calls).not.toContain("listing.applyDraft");
  });

  it("quota ou plafond atteint : l'agent s'arrête net, sans appeler l'IA pour la suite", async () => {
    const { ports } = harness();
    const { map, calls } = toolsFor((i) => (i === 0 ? ok : { ok: false, reason: "quota atteint", stop: true }));
    const outcome = await runMission(listingAnalystAgent, map, ports, {});
    expect(outcome.status).toBe("reussie");
    if (outcome.status === "reussie") expect(outcome.summary.text).toContain("1 analyse(s)");
    if (outcome.status === "reussie") expect(outcome.summary.text).toContain("Arrêt : quota atteint");
    expect(calls.filter((c) => c === "ai.analyzeListing")).toHaveLength(2);
  });

  it("un élément refusé (ex. : pas assez de ventes) est sauté, les suivants sont traités", async () => {
    const { ports } = harness();
    const { map } = toolsFor((i) => (i === 1 ? { ok: false, reason: "trop peu de ventes", stop: false } : ok));
    const outcome = await runMission(followupWriterAgent, map, ports, {});
    expect(outcome.status).toBe("reussie");
    if (outcome.status === "reussie") expect(outcome.summary.counts).toEqual({ alertes: 8, messages: 4, ignores: 1 });
  });
});
