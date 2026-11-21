/**
 * Lectures des comptes rendus de visite. La base filtre (migration 0018) : auteur, organisateur
 * de la visite, responsable du bien, gérant et managers.
 */
import { withTenant } from "@immopilot/db";
import type { PriceOpinion, VisitInterest, VisitNextStep } from "@immopilot/domain";
import type { AgencyContext } from "../agency/context";
import { getTenantPool } from "../server/db";

export interface VisitReport {
  id: string;
  appointment_id: string;
  property_id: string | null;
  author_user_id: string;
  interest: VisitInterest;
  price_opinion: PriceOpinion | null;
  next_step: VisitNextStep;
  positives: string | null;
  objections: string | null;
  updated_at: Date;
  /** Date de la visite (si le rendez-vous est visible). */
  visit_at: Date | null;
}

const tenant = (ctx: AgencyContext) => ({ orgId: ctx.org.id, userId: ctx.user.id });

export async function reportForAppointment(ctx: AgencyContext, appointmentId: string): Promise<VisitReport | null> {
  return withTenant(getTenantPool(), tenant(ctx), async (_db, c) =>
    (await c.query<VisitReport>(
      `SELECT vr.*, a.starts_at AS visit_at FROM app.visit_reports vr
       LEFT JOIN app.appointments a ON a.id = vr.appointment_id WHERE vr.appointment_id = $1`,
      [appointmentId],
    )).rows[0] ?? null);
}

export async function reportsForProperty(ctx: AgencyContext, propertyId: string): Promise<VisitReport[]> {
  return withTenant(getTenantPool(), tenant(ctx), async (_db, c) =>
    (await c.query<VisitReport>(
      `SELECT vr.*, a.starts_at AS visit_at FROM app.visit_reports vr
       LEFT JOIN app.appointments a ON a.id = vr.appointment_id
       WHERE vr.property_id = $1 ORDER BY coalesce(a.starts_at, vr.created_at) DESC LIMIT 100`,
      [propertyId],
    )).rows);
}

/** Mes visites passées (30 derniers jours), non annulées, encore sans compte rendu. */
export async function visitsWithoutReport(ctx: AgencyContext): Promise<Array<{ id: string; title: string; starts_at: Date; property_label: string | null }>> {
  return withTenant(getTenantPool(), tenant(ctx), async (_db, c) =>
    (await c.query(
      `SELECT a.id, a.title, a.starts_at, p.address_label AS property_label
       FROM app.appointments a
       LEFT JOIN app.properties p ON p.id = a.property_id
       WHERE a.kind = 'visite' AND a.status = 'prevu' AND a.organizer_user_id = $1
         AND a.starts_at <= now() AND a.starts_at > now() - interval '30 days'
         AND NOT EXISTS (SELECT 1 FROM app.visit_reports vr WHERE vr.appointment_id = a.id)
       ORDER BY a.starts_at DESC LIMIT 20`,
      [ctx.user.id],
    )).rows);
}
