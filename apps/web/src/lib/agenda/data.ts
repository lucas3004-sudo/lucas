/**
 * Lectures de l'agenda. La base filtre : organisateur, auteur, gérant et managers.
 * Le nom du contact et l'adresse du bien ne s'affichent que s'ils sont visibles (RLS).
 */
import { withTenant } from "@immopilot/db";
import type { AgencyContext } from "../agency/context";
import { getTenantPool } from "../server/db";
import type { AppointmentKind } from "./labels";

export interface Appointment {
  id: string;
  organizer_user_id: string;
  created_by: string;
  kind: AppointmentKind;
  title: string;
  starts_at: Date;
  ends_at: Date;
  location: string | null;
  notes: string | null;
  status: "prevu" | "annule";
  contact_id: string | null;
  property_id: string | null;
  updated_at: Date;
  contact_name: string | null;
  property_label: string | null;
  /** Un compte rendu de visite existe (et m'est visible). */
  has_report: boolean;
}

export async function listAppointments(
  ctx: AgencyContext,
  options: { scope?: "mine" | "team"; from?: Date; to?: Date; contactId?: string; propertyId?: string; id?: string; limit?: number } = {},
): Promise<Appointment[]> {
  const { scope = "team", from = null, to = null, contactId = null, propertyId = null, id = null, limit = 200 } = options;
  return withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    (await c.query<Appointment>(
      `SELECT a.*, NULLIF(concat_ws(' ', ct.first_name, ct.last_name), '') AS contact_name, p.address_label AS property_label,
              EXISTS (SELECT 1 FROM app.visit_reports vr WHERE vr.appointment_id = a.id) AS has_report
       FROM app.appointments a
       LEFT JOIN app.contacts ct ON ct.id = a.contact_id
       LEFT JOIN app.properties p ON p.id = a.property_id
       WHERE ($1 = 'team' OR a.organizer_user_id = $2)
         AND ($3::timestamptz IS NULL OR a.ends_at >= $3) AND ($4::timestamptz IS NULL OR a.starts_at < $4)
         AND ($5::uuid IS NULL OR a.contact_id = $5) AND ($6::uuid IS NULL OR a.property_id = $6)
         AND ($7::uuid IS NULL OR a.id = $7)
       ORDER BY a.starts_at LIMIT $8`,
      [scope, ctx.user.id, from, to, contactId, propertyId, id, limit],
    )).rows,
  );
}
