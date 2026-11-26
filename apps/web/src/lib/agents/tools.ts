/**
 * Outils des agents, liés à l'identité de l'utilisateur qui lance la mission (la RLS s'applique).
 * Un agent n'y accède que par la passerelle (@immopilot/agents) : liste fermée, niveau, budget.
 */
import type { DeadlineItem, DuplicateGroup, MandateItem, MissedMatch, ToolDefinition } from "@immopilot/agents";
import { withTenant } from "@immopilot/db";
import { duplicateGroups, mandateAlert, utcToParisLocal } from "@immopilot/domain";
import { z } from "zod";
import type { AgencyContext } from "../agency/context";
import { ALERT_TITLE_PREFIX, matchesByOwner } from "../crm/alerts";
import { activeProfiles, asMatchProfile, asMatchProperty, listProperties, matchableProperties } from "../crm/data";
import { listDeals } from "../deals/data";
import { dealDeadlines } from "../deals/deadlines";
import { qualityCounts, qualityReport } from "../quality/report";
import { getTenantPool } from "../server/db";
import { buildAiTools, type AiMeter } from "./ai-tools";
import { mergeContacts } from "./merge";

export const MANDATE_REMINDER_PREFIX = "Mandat à renouveler";

const REASONS: Record<string, string> = { email: "même e-mail", telephone: "même téléphone", nom: "même nom complet" };

export function buildTools(ctx: AgencyContext, meter: AiMeter = { costMicroUsd: 0 }): Map<string, ToolDefinition<never, unknown>> {
  const tenant = { orgId: ctx.org.id, userId: ctx.user.id };
  const seesAll = ctx.role === "gerant" || ctx.role === "manager";
  const today = () => utcToParisLocal(new Date()).slice(0, 10);

  const tools: ToolDefinition<never, unknown>[] = [
    {
      id: "quality.report",
      level: "L0",
      description: "Rapport de qualité des données (nombres seulement)",
      input: z.object({}).strict(),
      run: async () => ({ counts: qualityCounts(await qualityReport(ctx, seesAll)) }),
    } as unknown as ToolDefinition<never, unknown>,
    {
      id: "deals.deadlines",
      level: "L0",
      description: "Échéances d'affaires proches ou dépassées",
      input: z.object({ withinDays: z.number().int().min(0).max(30) }),
      run: async (input: { withinDays: number }): Promise<DeadlineItem[]> =>
        (await listDeals(ctx))
          .filter((d) => seesAll || d.owner_user_id === ctx.user.id)
          .flatMap((d) =>
            dealDeadlines(d, today())
              .filter((dl) => dl.daysLeft <= input.withinDays)
              .map((dl) => ({ dealId: d.id, ownerUserId: d.owner_user_id, key: dl.key, label: dl.label, date: dl.date, daysLeft: dl.daysLeft, propertyLabel: d.property_label })),
          ),
    } as unknown as ToolDefinition<never, unknown>,
    {
      id: "tasks.createReminder",
      level: "L1",
      description: "Créer une tâche de rappel d'échéance (sans doublon)",
      input: z.object({
        assigneeUserId: z.uuid(), dealId: z.uuid(), key: z.string().max(40), title: z.string().min(2).max(200),
        details: z.string().max(2000), dueOn: z.iso.date(),
      }),
      run: async (input: { assigneeUserId: string; dealId: string; title: string; details: string; dueOn: string }) =>
        withTenant(getTenantPool(), tenant, async (_db, c) => {
          const deal = (await c.query<{ property_id: string }>("SELECT property_id FROM app.deals WHERE id = $1", [input.dealId])).rows[0];
          if (!deal) return { created: false };
          const exists = await c.query(
            "SELECT 1 FROM app.tasks WHERE assignee_user_id = $1 AND property_id = $2 AND title = $3 AND status = 'a_faire'",
            [input.assigneeUserId, deal.property_id, input.title],
          );
          if (exists.rowCount) return { created: false };
          await c.query(
            `INSERT INTO app.tasks (org_id, assignee_user_id, created_by, title, details, due_on, property_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [ctx.org.id, input.assigneeUserId, ctx.user.id, input.title, `${input.details} Rappel créé par l'agent Veille des échéances.`, input.dueOn, deal.property_id],
          );
          return { created: true };
        }),
    } as unknown as ToolDefinition<never, unknown>,
    {
      id: "mandates.expiring",
      level: "L0",
      description: "Mandats qui se terminent dans 30 jours ou sont expirés (biens sous mandat ou sous offre)",
      input: z.object({}).strict(),
      run: async (): Promise<MandateItem[]> =>
        (await listProperties(ctx))
          .filter((p) => seesAll || p.owner_user_id === ctx.user.id)
          .flatMap((p) => {
            const alert = mandateAlert({ status: p.status, mandateEndsOn: p.mandate_ends_on }, today());
            if (!alert || !p.mandate_ends_on) return [];
            return [{
              propertyId: p.id, ownerUserId: p.owner_user_id, propertyLabel: p.address_label, mandateNumber: p.mandate_number,
              endsOn: p.mandate_ends_on, daysLeft: alert.kind === "expire" ? -alert.daysAgo : alert.daysLeft,
            }];
          }),
    } as unknown as ToolDefinition<never, unknown>,
    {
      id: "tasks.createMandateReminder",
      level: "L1",
      description: "Créer une tâche de rappel de fin de mandat pour le responsable du bien (sans doublon)",
      input: z.object({
        propertyId: z.uuid(), assigneeUserId: z.uuid(), title: z.string().min(2).max(200), details: z.string().max(2000), dueOn: z.iso.date(),
      }),
      run: async (input: { propertyId: string; assigneeUserId: string; title: string; details: string; dueOn: string }) =>
        withTenant(getTenantPool(), tenant, async (_db, c) => {
          // Le bien doit être visible (RLS) et le destinataire en être le responsable.
          const property = (await c.query<{ owner_user_id: string }>("SELECT owner_user_id FROM app.properties WHERE id = $1", [input.propertyId])).rows[0];
          if (!property || property.owner_user_id !== input.assigneeUserId) return { created: false };
          const exists = await c.query(
            "SELECT 1 FROM app.tasks WHERE assignee_user_id = $1 AND property_id = $2 AND status = 'a_faire' AND title LIKE $3",
            [input.assigneeUserId, input.propertyId, `${MANDATE_REMINDER_PREFIX}%`],
          );
          if (exists.rowCount) return { created: false };
          await c.query(
            `INSERT INTO app.tasks (org_id, assignee_user_id, created_by, title, details, due_on, property_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [ctx.org.id, input.assigneeUserId, ctx.user.id, input.title, `${input.details} Rappel créé par l'agent Veille des mandats.`, input.dueOn, input.propertyId],
          );
          return { created: true };
        }),
    } as unknown as ToolDefinition<never, unknown>,
    {
      id: "matching.missed",
      level: "L0",
      description: "Correspondances (75 % ou plus) pas encore signalées aux responsables des acquéreurs",
      input: z.object({}).strict(),
      run: async (): Promise<MissedMatch[]> => {
        const [properties, profiles] = await Promise.all([matchableProperties(ctx), activeProfiles(ctx)]);
        const signalled = await withTenant(getTenantPool(), tenant, async (_db, c) =>
          new Set(
            (await c.query<{ k: string }>(
              `SELECT assignee_user_id || '|' || property_id AS k FROM app.tasks WHERE status = 'a_faire' AND property_id IS NOT NULL AND title LIKE $1`,
              [`${ALERT_TITLE_PREFIX}%`],
            )).rows.map((r) => r.k),
          ));
        const prepared = profiles.map((p) => ({ ownerUserId: p.owner_user_id, profile: asMatchProfile(p) }));
        return properties.flatMap((prop) =>
          matchesByOwner(asMatchProperty(prop), prepared, prop.owner_user_id)
            .filter((m) => !signalled.has(`${m.ownerUserId}|${prop.id}`))
            .map((m) => ({ propertyId: prop.id, ownerUserId: m.ownerUserId, best: m.best, count: m.count, propertyLabel: prop.address_label })),
        );
      },
    } as unknown as ToolDefinition<never, unknown>,
    {
      id: "tasks.createMatchAlert",
      level: "L1",
      description: "Prévenir un collègue qu'un bien correspond à ses acquéreurs (sans doublon)",
      input: z.object({ propertyId: z.uuid(), ownerUserId: z.uuid(), best: z.number().int().min(0).max(100), count: z.number().int().min(1), propertyLabel: z.string().max(300) }),
      run: async (m: MissedMatch) =>
        withTenant(getTenantPool(), tenant, async (_db, c) => {
          const exists = await c.query(
            "SELECT 1 FROM app.tasks WHERE assignee_user_id = $1 AND property_id = $2 AND status = 'a_faire' AND title LIKE $3",
            [m.ownerUserId, m.propertyId, `${ALERT_TITLE_PREFIX}%`],
          );
          const member = await c.query("SELECT app.is_member($1) AS ok", [m.ownerUserId]);
          if (exists.rowCount || !member.rows[0]?.ok) return { created: false };
          await c.query(
            `INSERT INTO app.tasks (org_id, assignee_user_id, created_by, title, details, property_id) VALUES ($1, $2, $3, $4, $5, $6)`,
            [ctx.org.id, m.ownerUserId, ctx.user.id, `${ALERT_TITLE_PREFIX} à vos acquéreurs (${m.best} %)`,
             `Le bien « ${m.propertyLabel} » correspond à ${m.count} de vos profils de recherche (meilleur score ${m.best} %). Signalé par l'agent Opportunity Finder.`, m.propertyId],
          );
          return { created: true };
        }),
    } as unknown as ToolDefinition<never, unknown>,
    {
      id: "contacts.duplicates",
      level: "L0",
      description: "Groupes de contacts en double (le plus ancien en premier)",
      input: z.object({}).strict(),
      run: async (): Promise<DuplicateGroup[]> =>
        withTenant(getTenantPool(), tenant, async (_db, c) => {
          const rows = (await c.query("SELECT id, first_name, last_name, email, phone FROM app.contacts ORDER BY created_at, id")).rows;
          // Une fusion déjà proposée et en attente n'est pas reproposée (le passage quotidien la reverrait sinon).
          const pending = new Set((await c.query<{ pair: string }>(
            `SELECT (payload->>'keepId') || '>' || (payload->>'removeId') AS pair FROM app.approvals
             WHERE tool = 'contacts.merge' AND status = 'en_attente' AND expires_at > now()`,
          )).rows.map((r) => r.pair));
          return duplicateGroups(rows.map((r) => ({ id: r.id, firstName: r.first_name, lastName: r.last_name, email: r.email, phone: r.phone })))
            .map((g) => ({ ...g, ids: g.ids.filter((id, i) => i === 0 || !pending.has(`${g.ids[0]}>${id}`)) }))
            .filter((g) => g.ids.length > 1);
        }),
    } as unknown as ToolDefinition<never, unknown>,
    {
      id: "contacts.merge",
      level: "L2",
      description: "Fusionner deux contacts en double",
      input: z.object({ keepId: z.uuid(), removeId: z.uuid(), reason: z.string().max(20) }),
      approvalTitle: (input: { reason: string }) => `Fusionner deux contacts en double (${REASONS[input.reason] ?? input.reason})`,
      // N'est jamais appelé par un agent (L2) : exécuté par la décision d'approbation, dans sa transaction.
      run: async (input: { keepId: string; removeId: string }) => withTenant(getTenantPool(), tenant, (_db, c) => mergeContacts(c, ctx, input)),
    } as unknown as ToolDefinition<never, unknown>,
  ];
  return new Map([...tools, ...buildAiTools(ctx, meter)].map((t) => [t.id, t]));
}
