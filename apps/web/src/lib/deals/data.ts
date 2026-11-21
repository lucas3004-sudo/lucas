/**
 * Lectures des affaires. La base filtre (une affaire suit la visibilité de son bien) ;
 * les noms des contacts ne s'affichent que s'ils sont visibles.
 */
import { withTenant } from "@immopilot/db";
import type { AgencyContext } from "../agency/context";
import { getTenantPool } from "../server/db";
import type { DealStage } from "./labels";

export interface Deal {
  id: string;
  property_id: string;
  owner_user_id: string;
  buyer_contact_id: string | null;
  seller_contact_id: string | null;
  stage: DealStage;
  price: number | null;
  fees: number | null;
  offer_accepted_on: string | null;
  compromis_signed_on: string | null;
  retraction_notified_on: string | null;
  loan_deadline: string | null;
  deed_planned_on: string | null;
  deed_signed_on: string | null;
  notary: string | null;
  notes: string | null;
  checklist: Record<string, boolean>;
  created_at: Date;
  updated_at: Date;
  property_label: string;
  buyer_name: string | null;
  seller_name: string | null;
}

const NUM = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function listDeals(ctx: AgencyContext, filter: { id?: string; propertyId?: string } = {}): Promise<Deal[]> {
  return withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    (await c.query(
      `SELECT d.id, d.property_id, d.owner_user_id, d.buyer_contact_id, d.seller_contact_id, d.stage, d.price, d.fees,
              d.offer_accepted_on::text, d.compromis_signed_on::text, d.retraction_notified_on::text, d.loan_deadline::text,
              d.deed_planned_on::text, d.deed_signed_on::text, d.notary, d.notes, d.checklist, d.created_at, d.updated_at,
              p.address_label AS property_label,
              NULLIF(concat_ws(' ', b.first_name, b.last_name), '') AS buyer_name,
              NULLIF(concat_ws(' ', s.first_name, s.last_name), '') AS seller_name
       FROM app.deals d
       JOIN app.properties p ON p.id = d.property_id
       LEFT JOIN app.contacts b ON b.id = d.buyer_contact_id
       LEFT JOIN app.contacts s ON s.id = d.seller_contact_id
       WHERE ($1::uuid IS NULL OR d.id = $1) AND ($2::uuid IS NULL OR d.property_id = $2)
       ORDER BY d.updated_at DESC LIMIT 500`,
      [filter.id ?? null, filter.propertyId ?? null],
    )).rows.map((r) => ({ ...r, price: NUM(r.price), fees: NUM(r.fees) }) as Deal),
  );
}

export async function getDeal(ctx: AgencyContext, id: string): Promise<Deal | null> {
  return (await listDeals(ctx, { id }))[0] ?? null;
}
