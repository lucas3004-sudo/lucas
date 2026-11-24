/**
 * Outils des agents assistés par l'IA (D-069), liés à l'identité de l'utilisateur (RLS).
 * Chaque outil « ai.* » vérifie le quota et le plafond, appelle l'IA avec les seules données du
 * bien et du marché, et renvoie un résultat ou une raison de refus. Les écritures restent des
 * outils séparés, passés par la passerelle (niveau, budget, approbation).
 */
import type { AiToolResult, FollowupCandidate, PropertyCandidate, ToolDefinition } from "@immopilot/agents";
import { withTenant } from "@immopilot/db";
import { utcToParisLocal } from "@immopilot/domain";
import { z } from "zod";
import type { AgencyContext } from "../agency/context";
import { ANALYSIS_SYSTEM, FOLLOWUP_SYSTEM, LISTING_SYSTEM, marketFacts, propertyFacts, readAnalysis, readListingDraft } from "../ai/agent-prompts";
import { aiText, STOP_REASONS } from "../ai/run";
import { ALERT_TITLE_PREFIX } from "../crm/alerts";
import { getProperty, type Property } from "../crm/data";
import { marketEstimate } from "../dossier/compute";
import { getTenantPool } from "../server/db";

export const ANALYSIS_TITLE_PREFIX = "Analyse de l'annonce";
export const FOLLOWUP_MARK = "Message proposé par l'agent Relances";

/** Coût mesuré des appels à l'IA d'une mission (micro-dollars). */
export interface AiMeter {
  costMicroUsd: number;
}

function department(insee: string): string {
  return insee.startsWith("97") ? insee.slice(0, 3) : insee.slice(0, 2);
}

async function propertyMarket(p: Property) {
  if (!p.surface || p.longitude === null || p.latitude === null) return { estimate: null, until: null };
  const m = /(\d{5})\s+(.+)$/.exec(p.address_label);
  const { estimate, market } = await marketEstimate(getTenantPool(), {
    label: p.address_label, banId: p.ban_id, inseeCode: p.insee_code, postcode: m?.[1] ?? "", city: m?.[2] ?? "",
    department: department(p.insee_code), longitude: p.longitude, latitude: p.latitude, score: 1, type: "housenumber",
  }, { type: p.type, surface: p.surface, rooms: p.rooms });
  return {
    estimate: estimate.status === "ok" ? { low: estimate.low, mid: estimate.mid, high: estimate.high, comparables: estimate.comparables } : null,
    until: market.value?.to ?? null,
  };
}

export function buildAiTools(ctx: AgencyContext, meter: AiMeter): ToolDefinition<never, unknown>[] {
  const tenant = { orgId: ctx.org.id, userId: ctx.user.id };
  const seesAll = ctx.role === "gerant" || ctx.role === "manager";
  const today = () => utcToParisLocal(new Date()).slice(0, 10);

  /** Appel à l'IA commun aux outils : coût compté, refus traduit pour l'agent. */
  async function ask<T>(feature: "copilot" | "annonce", system: string, prompt: string, maxTokens: number, read: (t: string) => T | null): Promise<AiToolResult<T>> {
    const r = await aiText(ctx, { feature, system, prompt, maxTokens });
    if (!r.ok) return { ok: false, reason: r.message, stop: STOP_REASONS.has(r.reason) };
    meter.costMicroUsd += r.costMicroUsd;
    const parsed = read(r.text);
    return parsed ? ({ ok: true, ...parsed } as AiToolResult<T>) : { ok: false, reason: "Réponse de l'IA inutilisable.", stop: false };
  }

  const candidates = (sql: string, params: unknown[] = []) =>
    withTenant(getTenantPool(), tenant, async (_db, c) =>
      (await c.query<PropertyCandidate>(sql, [seesAll, ctx.user.id, ...params])).rows);

  const tools = [
    // 1. Rédaction d'annonce
    {
      id: "listings.needingText",
      level: "L0",
      description: "Biens en vente sans vraie description d'annonce (sans proposition en attente ni refusée récemment)",
      input: z.object({}).strict(),
      run: () => candidates(
        `SELECT p.id AS "propertyId", p.owner_user_id AS "ownerUserId", p.address_label AS label FROM app.properties p
         WHERE p.status = 'mandat' AND (p.listing_description IS NULL OR length(trim(p.listing_description)) < 80)
           AND ($1 OR p.owner_user_id = $2)
           AND NOT EXISTS (SELECT 1 FROM app.approvals a WHERE a.tool = 'listing.applyDraft' AND a.payload->>'propertyId' = p.id::text
             AND ((a.status = 'en_attente' AND a.expires_at > now()) OR (a.status = 'refusee' AND a.decided_at > now() - interval '30 days')))
         ORDER BY p.created_at LIMIT 20`),
    },
    {
      id: "ai.writeListing",
      level: "L0",
      description: "Rédiger par IA le titre et le texte d'annonce d'un bien (données du bien seulement)",
      input: z.object({ propertyId: z.uuid() }),
      run: async (input: { propertyId: string }) => {
        const p = await getProperty(ctx, input.propertyId);
        if (!p) return { ok: false, reason: "Bien introuvable.", stop: false };
        return ask("annonce", LISTING_SYSTEM, `Fiche du bien :\n${propertyFacts(p)}`, 900, readListingDraft);
      },
    },
    {
      id: "listing.applyDraft",
      level: "L2",
      description: "Enregistrer une annonce rédigée par l'IA sur la fiche du bien",
      input: z.object({ propertyId: z.uuid(), title: z.string().min(1).max(120), description: z.string().min(50).max(4000) }),
      approvalTitle: () => "Enregistrer une annonce rédigée par l'IA",
      // N'est jamais appelé par un agent (L2) : exécuté par la décision d'approbation.
      run: async () => ({}),
    },

    // 2. Analyse d'annonce
    {
      id: "analysis.candidates",
      level: "L0",
      description: "Biens en vente pas encore analysés depuis leur dernier prix",
      input: z.object({}).strict(),
      run: () => candidates(
        `SELECT p.id AS "propertyId", p.owner_user_id AS "ownerUserId", p.address_label AS label FROM app.properties p
         WHERE p.status = 'mandat' AND p.price IS NOT NULL AND p.surface IS NOT NULL AND ($1 OR p.owner_user_id = $2)
           AND NOT EXISTS (SELECT 1 FROM app.tasks t WHERE t.property_id = p.id AND t.title LIKE $3
             AND t.created_at >= coalesce((SELECT max(e.created_at) FROM app.property_events e WHERE e.property_id = p.id AND e.kind IN ('cree', 'prix')), p.created_at))
         ORDER BY p.created_at LIMIT 20`, [`${ANALYSIS_TITLE_PREFIX}%`]),
    },
    {
      id: "ai.analyzeListing",
      level: "L0",
      description: "Analyser par IA l'annonce et le prix d'un bien face au marché (DVF)",
      input: z.object({ propertyId: z.uuid() }),
      run: async (input: { propertyId: string }) => {
        const p = await getProperty(ctx, input.propertyId);
        if (!p) return { ok: false, reason: "Bien introuvable.", stop: false };
        const { estimate, until } = await propertyMarket(p);
        const listing = [p.listing_title ? `Titre de l'annonce : ${p.listing_title}` : "Titre de l'annonce : aucun", p.listing_description ? `Texte de l'annonce : ${p.listing_description.slice(0, 2500)}` : "Texte de l'annonce : aucun"].join("\n");
        return ask("copilot", ANALYSIS_SYSTEM, `Fiche du bien :\n${propertyFacts(p)}\n\n${listing}\n\n${marketFacts(estimate, until)}`, 900, readAnalysis);
      },
    },
    {
      id: "tasks.createAnalysis",
      level: "L1",
      description: "Envoyer l'analyse au responsable du bien (tâche, sans doublon)",
      input: z.object({ propertyId: z.uuid(), assigneeUserId: z.uuid(), title: z.string().min(2).max(200), details: z.string().min(1).max(2000) }),
      run: async (input: { propertyId: string; assigneeUserId: string; title: string; details: string }) =>
        withTenant(getTenantPool(), tenant, async (_db, c) => {
          const open = await c.query("SELECT 1 FROM app.tasks WHERE property_id = $1 AND status = 'a_faire' AND title LIKE $2", [input.propertyId, `${ANALYSIS_TITLE_PREFIX}%`]);
          const member = await c.query("SELECT app.is_member($1) AS ok", [input.assigneeUserId]);
          if (open.rowCount || !member.rows[0]?.ok) return { created: false };
          await c.query(
            `INSERT INTO app.tasks (org_id, assignee_user_id, created_by, title, details, property_id, due_on) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [ctx.org.id, input.assigneeUserId, ctx.user.id, input.title, `${input.details}\n\n(Analyse rédigée par l'IA à partir des données du bien et des ventes DVF : à relire.)`.slice(0, 2000), input.propertyId, today()],
          );
          return { created: true };
        }),
    },

    // 3. Relances
    {
      id: "followups.candidates",
      level: "L0",
      description: "Alertes « bien correspondant » à traiter, sans message préparé",
      input: z.object({}).strict(),
      run: () =>
        withTenant(getTenantPool(), tenant, async (_db, c) =>
          (await c.query<FollowupCandidate>(
            `SELECT t.id AS "taskId", t.property_id AS "propertyId" FROM app.tasks t
             WHERE t.assignee_user_id = $1 AND t.status = 'a_faire' AND t.property_id IS NOT NULL AND t.title LIKE $2
               AND coalesce(t.details, '') NOT LIKE $3
             ORDER BY t.created_at LIMIT 20`,
            [ctx.user.id, `${ALERT_TITLE_PREFIX}%`, `%${FOLLOWUP_MARK}%`],
          )).rows),
    },
    {
      id: "ai.buyerMessage",
      level: "L0",
      description: "Rédiger par IA un message pour présenter un bien à un acquéreur (sans son nom)",
      input: z.object({ propertyId: z.uuid() }),
      run: async (input: { propertyId: string }) => {
        const p = await getProperty(ctx, input.propertyId);
        if (!p) return { ok: false, reason: "Bien introuvable.", stop: false };
        const listing = p.listing_description ? `\nAnnonce : ${p.listing_description.slice(0, 1500)}` : "";
        return ask("copilot", FOLLOWUP_SYSTEM, `Fiche du bien :\n${propertyFacts(p)}${listing}`, 600, (t) => {
          const text = t.trim();
          return text.length >= 40 ? { message: text.slice(0, 900) } : null;
        });
      },
    },
    {
      id: "tasks.attachMessage",
      level: "L1",
      description: "Ajouter le message préparé à la tâche (rien n'est envoyé)",
      input: z.object({ taskId: z.uuid(), message: z.string().min(1).max(900) }),
      run: async (input: { taskId: string; message: string }) =>
        withTenant(getTenantPool(), tenant, async (_db, c) => {
          const signature = `\n\n${ctx.user.name}\n${ctx.org.name}`;
          const block = `${FOLLOWUP_MARK} (à relire, rien n'a été envoyé) :\n${input.message}${signature}`;
          const r = await c.query(
            `UPDATE app.tasks SET details = left(CASE WHEN coalesce(details, '') = '' THEN $2 ELSE details || E'\\n\\n' || $2 END, 2000)
             WHERE id = $1 AND assignee_user_id = $3 AND status = 'a_faire' AND coalesce(details, '') NOT LIKE $4`,
            [input.taskId, block, ctx.user.id, `%${FOLLOWUP_MARK}%`],
          );
          return { updated: (r.rowCount ?? 0) > 0 };
        }),
    },
  ];
  return tools as unknown as ToolDefinition<never, unknown>[];
}
