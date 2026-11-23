/**
 * Assistant IA d'ImmoPilot (D-063) : répond aux questions sur l'utilisation du logiciel et sur
 * les données de l'agence, à partir d'un instantané lu sous RLS (ce que l'utilisateur voit).
 *
 * Garde-fous :
 * - aucun appel sans clé, au-delà du quota de la formule ou du plafond de dépenses global ;
 * - aucune donnée personnelle de contact envoyée (ni nom, ni téléphone, ni e-mail) : seulement
 *   les biens, des critères de recherche anonymes et des chiffres ;
 * - chaque appel est enregistré (jetons, coût), jamais le texte des questions ni des réponses.
 */
import Anthropic from "@anthropic-ai/sdk";
import { withTenant } from "@immopilot/db";
import { aiCostMicroUsd, aiGate, AI_GATE_MESSAGES, parisMonthStart, recapLines, type AiGateReason } from "@immopilot/domain";
import type { AgencyContext } from "../agency/context";
import { ROLE_LABELS } from "../auth/roles";
import { agencyPlanAndUsage, quotaFor } from "../billing/plan";
import { activeProfiles, listProperties } from "../crm/data";
import { PROPERTY_STATUS } from "../crm/labels";
import { fmt } from "../format";
import { recapData } from "../recap/data";
import { getTenantPool } from "../server/db";
import { aiConfig } from "./config";
import { guideAsText } from "./guide";

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export type AssistantResult = { ok: true; answer: string } | { ok: false; reason: AiGateReason | "erreur" | "refus"; message: string };

const MAX_HISTORY = 10;
const MAX_PROPERTIES = 60;
const MAX_PROFILES = 40;

/** L'IA peut-elle être utilisée maintenant par cet utilisateur ? */
export async function assistantGate(ctx: AgencyContext): Promise<AiGateReason | null> {
  const config = aiConfig();
  if (!config.enabled) return "desactivee";
  const { current, usage } = await agencyPlanAndUsage(ctx);
  const check = quotaFor(current, usage, "copilot", 0);
  const budgetLeft = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    (await c.query<{ ok: boolean }>("SELECT app.ai_budget_left($1, $2) AS ok", [parisMonthStart(new Date()), config.monthlyBudgetMicroUsd])).rows[0]?.ok ?? false);
  return aiGate({ enabled: true, role: ctx.role, limit: check.limit, used: check.used, budgetLeft });
}

/** Instantané de l'agence, tel que l'utilisateur le voit, sans donnée personnelle de contact. */
async function agencySnapshot(ctx: AgencyContext): Promise<string> {
  const [properties, profiles, week] = await Promise.all([listProperties(ctx), activeProfiles(ctx), recapData(ctx, "semaine")]);
  const propertyLines = properties.slice(0, MAX_PROPERTIES).map((p) =>
    [
      p.address_label,
      p.type,
      p.surface ? `${fmt.number(p.surface)} m²` : null,
      p.rooms ? `${p.rooms} pièces` : null,
      p.price ? fmt.euros(p.price) : "prix non renseigné",
      PROPERTY_STATUS[p.status],
      p.mandate_type ? `mandat ${p.mandate_type}` : null,
      p.dpe_class ? `DPE ${p.dpe_class}` : null,
    ].filter(Boolean).join(" · "));
  const profileLines = profiles.slice(0, MAX_PROFILES).map((p) =>
    [
      p.types.length ? p.types.join(" ou ") : "tout type",
      p.budget_max ? `budget max ${fmt.euros(p.budget_max)}` : null,
      p.surface_min ? `${p.surface_min} m² min` : null,
      p.rooms_min ? `${p.rooms_min} pièces min` : null,
      p.insee_codes.length ? `${p.insee_codes.length} commune(s) visée(s)` : null,
    ].filter(Boolean).join(" · "));
  const recap = recapLines(week.counts).map((l) => `- ${l.text}`).join("\n") || "- rien de nouveau";
  return [
    `Agence : ${ctx.org.name}. Utilisateur : ${ctx.user.name.split(" ")[0]} (${ROLE_LABELS[ctx.role]}).`,
    `Biens visibles (${properties.length}${properties.length > MAX_PROPERTIES ? `, ${MAX_PROPERTIES} premiers listés` : ""}) :`,
    propertyLines.map((l) => `- ${l}`).join("\n") || "- aucun",
    `Recherches d'acquéreurs actives (${profiles.length}, anonymes) :`,
    profileLines.map((l) => `- ${l}`).join("\n") || "- aucune",
    "Activité des 7 derniers jours :",
    recap,
  ].join("\n");
}

const SYSTEM_RULES = `Tu es l'assistant d'ImmoPilot, un logiciel pour les agences immobilières françaises.
Réponds toujours en français, simplement, en quelques phrases courtes, sans jargon.
Pour expliquer comment faire quelque chose dans ImmoPilot, appuie-toi uniquement sur le guide ci-dessous et indique où cliquer.
Pour les questions sur l'agence, appuie-toi uniquement sur les données fournies ; si l'information n'y est pas, dis-le et indique où la trouver dans ImmoPilot.
N'invente jamais de chiffre, de prix, de bien ni de fonction qui n'existe pas.
Tu ne connais pas les noms ni les coordonnées des contacts : ils ne te sont pas transmis.
Pour une question juridique, fiscale ou une estimation officielle, rappelle que ta réponse est indicative et qu'il faut vérifier auprès d'un professionnel.`;

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

export async function askAssistant(ctx: AgencyContext, history: ChatTurn[], question: string): Promise<AssistantResult> {
  const gate = await assistantGate(ctx);
  if (gate) return { ok: false, reason: gate, message: AI_GATE_MESSAGES[gate] };

  const config = aiConfig();
  const snapshot = await agencySnapshot(ctx);
  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-MAX_HISTORY).map((t) => ({ role: t.role, content: t.text })),
    { role: "user", content: question },
  ];
  // L'API exige que la conversation commence par l'utilisateur.
  while (messages.length && messages[0]!.role !== "user") messages.shift();

  let status: "ok" | "refus" | "erreur" = "erreur";
  let inputTokens = 0;
  let outputTokens = 0;
  let result: AssistantResult = { ok: false, reason: "erreur", message: "L'assistant n'a pas pu répondre. Réessayez dans un instant." };
  try {
    const response = await anthropic().messages.create({
      model: config.model,
      max_tokens: 1024,
      // Réponses courtes et peu coûteuses : pas de réflexion longue pour de l'aide au quotidien.
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: [
        { type: "text", text: `${SYSTEM_RULES}\n\nGuide d'ImmoPilot :\n${guideAsText()}`, cache_control: { type: "ephemeral" } },
        { type: "text", text: `Données de l'agence (à jour) :\n${snapshot}` },
      ],
      messages,
    });
    inputTokens = response.usage.input_tokens + (response.usage.cache_creation_input_tokens ?? 0) + (response.usage.cache_read_input_tokens ?? 0);
    outputTokens = response.usage.output_tokens;
    if (response.stop_reason === "refusal") {
      status = "refus";
      result = { ok: false, reason: "refus", message: "L'assistant ne peut pas répondre à cette demande." };
    } else {
      const answer = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      status = "ok";
      result = { ok: true, answer: answer || "Je n'ai pas de réponse à cette question." };
    }
  } catch (error) {
    if (!(error instanceof Anthropic.APIError)) throw error;
  }

  await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, (_db, c) =>
    c.query(
      `INSERT INTO app.ai_runs (org_id, user_id, feature, model, status, input_tokens, output_tokens, cost_microusd)
       VALUES ($1, $2, 'copilot', $3, $4, $5, $6, $7)`,
      [ctx.org.id, ctx.user.id, config.model, status, inputTokens, outputTokens, aiCostMicroUsd(config.model, inputTokens, outputTokens)],
    ));
  return result;
}
