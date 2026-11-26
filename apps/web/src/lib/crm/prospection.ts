/**
 * Liste de prospection (D-072) : les biens suivis par l'agence, avec leur propriétaire (contact
 * vendeur, s'il est visible), ses accords en cours et la prochaine tâche prévue. Tout est lu sous
 * RLS : chacun ne voit que les biens, contacts et tâches que ses droits permettent.
 */
import { withTenant } from "@immopilot/db";
import { sortProspects, utcToParisLocal, type ProspectionStatus } from "@immopilot/domain";
import type { AgencyContext } from "../agency/context";
import { getTenantPool } from "../server/db";
import { contactName } from "./data";

export interface Prospect {
  id: string;
  ownerUserId: string;
  visibility: "private" | "agency";
  propertyStatus: string;
  status: ProspectionStatus;
  favorite: boolean;
  sourceUrl: string | null;
  type: "Appartement" | "Maison";
  addressLabel: string;
  surface: number | null;
  rooms: number | null;
  price: number | null;
  notes: string | null;
  updatedAt: Date;
  /** Propriétaire visible ; null s'il n'est pas renseigné ou s'il est un contact privé d'un collègue. */
  seller: { id: string; name: string; phone: string | null; email: string | null; phoneConsent: boolean; emailConsent: boolean } | null;
  /** Un propriétaire est rattaché, mais son contact est privé (collègue). */
  sellerHidden: boolean;
  /** Prochaine tâche ouverte sur ce bien (relance, rappel), AAAA-MM-JJ. */
  followUpOn: string | null;
}

const NUM = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function listProspects(ctx: AgencyContext): Promise<Prospect[]> {
  const today = utcToParisLocal(new Date()).slice(0, 10);
  const rows = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    (await c.query(
      `SELECT p.id, p.owner_user_id, p.visibility, p.status, p.prospection_status, p.prospection_favorite, p.source_url, p.type,
              p.address_label, p.surface, p.rooms, p.price, p.notes, p.updated_at, p.seller_contact_id,
              s.id AS seller_id, s.first_name, s.last_name, s.phone, s.email,
              coalesce((SELECT cc.status = 'accorde' AND (cc.expires_at IS NULL OR cc.expires_at >= $1::date) FROM app.contact_consents cc
                        WHERE cc.contact_id = s.id AND cc.channel = 'telephone' ORDER BY cc.recorded_at DESC LIMIT 1), false) AS phone_ok,
              coalesce((SELECT cc.status = 'accorde' AND (cc.expires_at IS NULL OR cc.expires_at >= $1::date) FROM app.contact_consents cc
                        WHERE cc.contact_id = s.id AND cc.channel = 'email' ORDER BY cc.recorded_at DESC LIMIT 1), false) AS email_ok,
              (SELECT min(t.due_on)::text FROM app.tasks t WHERE t.property_id = p.id AND t.status = 'a_faire') AS follow_up_on
       FROM app.properties p LEFT JOIN app.contacts s ON s.id = p.seller_contact_id
       WHERE p.prospection_status IS NOT NULL
       ORDER BY p.updated_at DESC LIMIT 500`,
      [today],
    )).rows);
  return sortProspects(
    rows.map((r): Prospect => ({
      id: r.id, ownerUserId: r.owner_user_id, visibility: r.visibility, propertyStatus: r.status, status: r.prospection_status,
      favorite: r.prospection_favorite, sourceUrl: r.source_url, type: r.type, addressLabel: r.address_label,
      surface: NUM(r.surface), rooms: NUM(r.rooms), price: NUM(r.price), notes: r.notes, updatedAt: r.updated_at,
      seller: r.seller_id
        ? { id: r.seller_id, name: contactName(r), phone: r.phone, email: r.email, phoneConsent: r.phone_ok, emailConsent: r.email_ok }
        : null,
      sellerHidden: !r.seller_id && !!r.seller_contact_id,
      followUpOn: r.follow_up_on,
    })),
  );
}
