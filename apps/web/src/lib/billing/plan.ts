/**
 * Formule de l'agence et consommation (D-048). Aucun paiement : la formule est attribuée par
 * l'exploitant (docs/deploiement-preprod.md) ; sans attribution, l'agence est en « Essai ».
 * Les compteurs sont calculés par la base (app.agency_usage) sur TOUTE l'agence, éléments
 * privés compris, sans jamais révéler ces éléments : seuls des nombres sortent.
 */
import { withTenant } from "@immopilot/db";
import { checkQuota, isPlanId, parisMonthStart, PLANS, quotaMessage, type Plan, type QuotaCheck, type QuotaMetric } from "@immopilot/domain";
import type { AgencyContext } from "../agency/context";
import { getTenantPool } from "../server/db";

export interface AgencyPlan {
  plan: Plan;
  extraSeats: number;
  /** Formule attribuée par l'exploitant (false : Essai par défaut). */
  assigned: boolean;
}

export type Usage = Record<QuotaMetric, number>;

export async function agencyPlanAndUsage(ctx: AgencyContext, now = new Date()): Promise<{ current: AgencyPlan; usage: Usage }> {
  return withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) => {
    const row = (await c.query<{ plan: string; extra_seats: number }>("SELECT plan, extra_seats FROM app.agency_plans")).rows[0];
    const counts = (await c.query<{ dossiers: number; contacts: number; membres: number; invitations: number }>(
      "SELECT * FROM app.agency_usage($1)", // quotas mensuels : depuis le 1er à minuit, heure de Paris
      [parisMonthStart(now)],
    )).rows[0];
    const current: AgencyPlan = row && isPlanId(row.plan)
      ? { plan: PLANS[row.plan], extraSeats: row.extra_seats, assigned: true }
      : { plan: PLANS.essai, extraSeats: 0, assigned: false };
    return {
      current,
      usage: {
        dossiers: counts?.dossiers ?? 0,
        contacts: counts?.contacts ?? 0,
        // Une invitation en attente réserve une place : sinon on dépasserait le quota à l'acceptation.
        membres: (counts?.membres ?? 0) + (counts?.invitations ?? 0),
        // Aucune IA activée (D-047) : rien n'est consommé.
        copilot: 0,
        annonces_ia: 0,
      },
    };
  });
}

export function quotaFor(current: AgencyPlan, usage: Usage, metric: QuotaMetric, adding = 1): QuotaCheck {
  return checkQuota(current.plan, metric, usage[metric], adding, current.extraSeats);
}

/**
 * Message d'erreur si l'ajout dépasse le quota, sinon null.
 * Contrôle « souple » : deux ajouts simultanés peuvent dépasser d'une unité (documenté, D-048).
 */
export async function quotaError(ctx: AgencyContext, metric: QuotaMetric, adding = 1): Promise<string | null> {
  const { current, usage } = await agencyPlanAndUsage(ctx);
  const check = quotaFor(current, usage, metric, adding);
  if (check.allowed) return null;
  const base = quotaMessage(current.plan, metric, check);
  if (adding > 1 && check.remaining !== null && check.remaining > 0) {
    return `${base} Vous pouvez encore en ajouter ${check.remaining} : réduisez le fichier.`;
  }
  return base;
}
