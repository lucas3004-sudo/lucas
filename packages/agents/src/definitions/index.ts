/**
 * Fiches des agents déterministes (sans IA, coût nul). Versionnées dans le code : toute
 * modification de leurs outils ou de leur plafond passe par une relecture du code.
 * Les outils sont implémentés par l'application (apps/web/src/lib/agents/tools.ts).
 */
import { z } from "zod";
import type { AgentDefinition, MissionSummary } from "../core";

const noInput = z.object({}).strict();

export interface QualityReport {
  counts: Record<string, number>;
}
export interface DeadlineItem {
  dealId: string;
  ownerUserId: string;
  key: string;
  label: string;
  date: string;
  daysLeft: number;
  propertyLabel: string;
}
export interface MissedMatch {
  propertyId: string;
  ownerUserId: string;
  best: number;
  count: number;
  propertyLabel: string;
}
export interface MandateItem {
  propertyId: string;
  ownerUserId: string;
  propertyLabel: string;
  mandateNumber: string | null;
  endsOn: string;
  /** Négatif : mandat expiré depuis -daysLeft jours. */
  daysLeft: number;
}
export interface DuplicateGroup {
  reason: string;
  ids: string[];
}

export const dataQualityAgent: AgentDefinition<Record<string, never>> = {
  id: "data-quality",
  version: "1.0.0",
  name: "Qualité des données",
  department: "crm",
  mode: "deterministe",
  description: "Recense les consentements manquants, doublons, annonces et biens incomplets, échéances dépassées. Ne corrige rien.",
  tools: ["quality.report"],
  maxPermission: "L0",
  budget: { maxSteps: 2 },
  input: noInput,
  async run(gateway): Promise<MissionSummary> {
    const r = await gateway.call<QualityReport>("quality.report", {});
    if (r.status !== "ok") throw new Error("Rapport indisponible.");
    const total = Object.values(r.result.counts).reduce((a, b) => a + b, 0);
    return { text: `${total} point(s) à reprendre.`, counts: r.result.counts };
  },
};

/** Rappel 3 jours avant une échéance d'affaire (et en cas de retard), sous forme de tâche. */
export const deadlineWatcherAgent: AgentDefinition<Record<string, never>> = {
  id: "deadline-watcher",
  version: "1.0.0",
  name: "Veille des échéances",
  department: "transactions",
  mode: "deterministe",
  description: "Crée une tâche de rappel pour chaque échéance d'affaire à 3 jours ou dépassée (rétractation, prêt, acte), sans doublon.",
  tools: ["deals.deadlines", "tasks.createReminder"],
  maxPermission: "L1",
  budget: { maxSteps: 60 },
  input: noInput,
  async run(gateway): Promise<MissionSummary> {
    const r = await gateway.call<DeadlineItem[]>("deals.deadlines", { withinDays: 3 });
    if (r.status !== "ok") throw new Error("Échéances indisponibles.");
    let created = 0;
    for (const d of r.result.slice(0, 50)) {
      const t = await gateway.call<{ created: boolean }>("tasks.createReminder", {
        assigneeUserId: d.ownerUserId,
        dealId: d.dealId,
        key: d.key,
        title: `Échéance : ${d.label}`,
        details: `${d.propertyLabel} — ${d.daysLeft < 0 ? `dépassée depuis ${-d.daysLeft} jour(s)` : d.daysLeft === 0 ? "aujourd'hui" : `dans ${d.daysLeft} jour(s)`} (${d.date}).`,
        dueOn: d.date,
      });
      if (t.status === "ok" && t.result.created) created += 1;
    }
    return { text: `${r.result.length} échéance(s) proche(s) ou dépassée(s), ${created} rappel(s) créé(s).`, counts: { echeances: r.result.length, rappels: created } };
  },
};

/** Rappel 30 jours avant la fin d'un mandat (et après la fin), sous forme de tâche pour le responsable du bien. */
export const mandateWatcherAgent: AgentDefinition<Record<string, never>> = {
  id: "mandate-watcher",
  version: "1.0.0",
  name: "Veille des mandats",
  department: "mandats",
  mode: "deterministe",
  description: "Crée une tâche pour le responsable de chaque bien dont le mandat se termine dans 30 jours ou est expiré, sans doublon. Ne modifie jamais le mandat.",
  tools: ["mandates.expiring", "tasks.createMandateReminder"],
  maxPermission: "L1",
  budget: { maxSteps: 60 },
  input: noInput,
  async run(gateway): Promise<MissionSummary> {
    const r = await gateway.call<MandateItem[]>("mandates.expiring", {});
    if (r.status !== "ok") throw new Error("Mandats indisponibles.");
    let created = 0;
    for (const m of r.result.slice(0, 50)) {
      const when = m.daysLeft < 0 ? `a expiré il y a ${-m.daysLeft} jour(s)` : m.daysLeft === 0 ? "se termine aujourd'hui" : `se termine dans ${m.daysLeft} jour(s)`;
      const t = await gateway.call<{ created: boolean }>("tasks.createMandateReminder", {
        propertyId: m.propertyId,
        assigneeUserId: m.ownerUserId,
        title: `Mandat à renouveler : ${m.propertyLabel}`.slice(0, 200),
        details: `Le mandat${m.mandateNumber ? ` n° ${m.mandateNumber}` : ""} ${when} (${m.endsOn}). Renouvelez-le avec le vendeur ou changez le statut du bien.`,
        dueOn: m.endsOn,
      });
      if (t.status === "ok" && t.result.created) created += 1;
    }
    return { text: `${r.result.length} mandat(s) à renouveler ou expiré(s), ${created} rappel(s) créé(s).`, counts: { mandats: r.result.length, rappels: created } };
  },
};

/** Rattrape les correspondances manquées (profils créés après le bien, critères modifiés). */
export const opportunityFinderAgent: AgentDefinition<Record<string, never>> = {
  id: "opportunity-finder",
  version: "1.0.0",
  name: "Opportunity Finder",
  department: "matching",
  mode: "deterministe",
  description: "Compare les biens proposés aux profils actifs et prévient les collègues concernés (75 % ou plus) qui ne l'ont pas encore été. Identité des acquéreurs jamais révélée.",
  tools: ["matching.missed", "tasks.createMatchAlert"],
  maxPermission: "L1",
  budget: { maxSteps: 120 },
  input: noInput,
  async run(gateway): Promise<MissionSummary> {
    const r = await gateway.call<MissedMatch[]>("matching.missed", {});
    if (r.status !== "ok") throw new Error("Rapprochement indisponible.");
    let created = 0;
    for (const m of r.result.slice(0, 100)) {
      const t = await gateway.call<{ created: boolean }>("tasks.createMatchAlert", m);
      if (t.status === "ok" && t.result.created) created += 1;
    }
    return { text: `${r.result.length} correspondance(s) non signalée(s), ${created} alerte(s) envoyée(s).`, counts: { correspondances: r.result.length, alertes: created } };
  },
};

/** Propose des fusions de doublons : chaque fusion attend l'approbation d'un humain habilité (L2). */
export const duplicateDetectionAgent: AgentDefinition<Record<string, never>> = {
  id: "duplicate-detection",
  version: "1.0.0",
  name: "Détection des doublons",
  department: "crm",
  mode: "deterministe",
  description: "Repère les contacts en double (même e-mail, téléphone ou nom complet) et propose leur fusion. Aucune fusion sans approbation.",
  tools: ["contacts.duplicates", "contacts.merge"],
  maxPermission: "L2",
  budget: { maxSteps: 30 },
  input: noInput,
  async run(gateway): Promise<MissionSummary> {
    const r = await gateway.call<DuplicateGroup[]>("contacts.duplicates", {});
    if (r.status !== "ok") throw new Error("Détection indisponible.");
    let proposed = 0;
    for (const g of r.result.slice(0, 25)) {
      // On garde le premier contact du groupe (le plus ancien) et on propose d'y fusionner chacun des autres.
      for (const removeId of g.ids.slice(1)) {
        const m = await gateway.call("contacts.merge", { keepId: g.ids[0], removeId, reason: g.reason });
        if (m.status === "approbation_demandee") proposed += 1;
      }
    }
    return { text: `${r.result.length} groupe(s) de doublons, ${proposed} fusion(s) proposée(s) à l'approbation.`, counts: { groupes: r.result.length, propositions: proposed } };
  },
};

export const AGENTS = [dataQualityAgent, opportunityFinderAgent, deadlineWatcherAgent, mandateWatcherAgent, duplicateDetectionAgent] as const;
export const AGENTS_BY_ID = new Map<string, AgentDefinition<Record<string, never>>>(AGENTS.map((a) => [a.id, a]));
