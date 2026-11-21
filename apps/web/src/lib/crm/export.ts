/**
 * Droit d'accès (RGPD, art. 15) : toutes les données d'un contact, en JSON lisible.
 * Réservé à qui peut modifier le contact (responsable, gérant, manager, assistant) ;
 * chaque export est journalisé (identifiant seulement).
 */
import { withTenant } from "@immopilot/db";
import { INTEREST_LABELS, NEXT_STEP_LABELS, PRICE_OPINION_LABELS, type PriceOpinion, type VisitInterest, type VisitNextStep } from "@immopilot/domain";
import type { AgencyContext } from "../agency/context";
import { audit } from "../audit";
import { getTenantPool } from "../server/db";
import { CONSENT_CHANNELS, CONTACT_ROLES, PROFILE_STATUS } from "./labels";

export type ExportResult = { status: "ok"; data: Record<string, unknown> } | { status: "not_found" } | { status: "forbidden" };

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v);

export async function exportContact(ctx: AgencyContext, contactId: string): Promise<ExportResult> {
  const result = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c): Promise<ExportResult> => {
    const contact = (await c.query("SELECT * FROM app.contacts WHERE id = $1", [contactId])).rows[0];
    if (!contact) return { status: "not_found" };
    const canEdit = contact.owner_user_id === ctx.user.id || ["gerant", "manager", "assistant"].includes(ctx.role);
    if (!canEdit) return { status: "forbidden" };

    const consents = (await c.query(
      `SELECT channel, status, obtained_at::text, expires_at::text, proof, recorded_at FROM app.contact_consents WHERE contact_id = $1 ORDER BY recorded_at`,
      [contactId],
    )).rows;
    const profiles = (await c.query(
      `SELECT status, types, budget_max, surface_min, rooms_min, insee_codes, features, created_at FROM app.buyer_profiles WHERE contact_id = $1 ORDER BY created_at`,
      [contactId],
    )).rows;
    const tasks = (await c.query(
      `SELECT title, details, due_on::text, status, created_at, done_at FROM app.tasks WHERE contact_id = $1 ORDER BY created_at`,
      [contactId],
    )).rows;

    const appointments = (await c.query(
      `SELECT a.kind, a.title, a.starts_at, a.ends_at, a.location, a.notes, a.status,
              vr.interest, vr.price_opinion, vr.next_step, vr.positives, vr.objections
       FROM app.appointments a LEFT JOIN app.visit_reports vr ON vr.appointment_id = a.id
       WHERE a.contact_id = $1 ORDER BY a.starts_at`,
      [contactId],
    )).rows;

    const deals = (await c.query(
      `SELECT d.stage, d.price, d.offer_accepted_on::text, d.compromis_signed_on::text, d.deed_signed_on::text, p.address_label,
              CASE WHEN d.buyer_contact_id = $1 THEN 'acquéreur' ELSE 'vendeur' END AS role
       FROM app.deals d JOIN app.properties p ON p.id = d.property_id
       WHERE d.buyer_contact_id = $1 OR d.seller_contact_id = $1 ORDER BY d.created_at`,
      [contactId],
    )).rows;

    return {
      status: "ok",
      data: {
        export: {
          objet: "Données personnelles détenues par l'agence (droit d'accès, RGPD art. 15)",
          agence: ctx.org.name,
          genere_le: new Date().toISOString(),
        },
        contact: {
          prenom: contact.first_name,
          nom: contact.last_name,
          email: contact.email,
          telephone: contact.phone,
          roles: (contact.roles as string[]).map((r) => CONTACT_ROLES[r as keyof typeof CONTACT_ROLES] ?? r),
          origine: contact.source,
          notes: contact.notes,
          cree_le: iso(contact.created_at),
          modifie_le: iso(contact.updated_at),
        },
        consentements: consents.map((x) => ({
          canal: CONSENT_CHANNELS[x.channel as keyof typeof CONSENT_CHANNELS] ?? x.channel,
          decision: x.status === "accorde" ? "accordé" : "retiré",
          recueilli_le: x.obtained_at,
          expire_le: x.expires_at,
          preuve: x.proof,
          enregistre_le: iso(x.recorded_at),
        })),
        profils_de_recherche: profiles.map((p) => ({
          statut: PROFILE_STATUS[p.status as keyof typeof PROFILE_STATUS] ?? p.status,
          types: p.types,
          budget_max: p.budget_max === null ? null : Number(p.budget_max),
          surface_min: p.surface_min === null ? null : Number(p.surface_min),
          pieces_min: p.rooms_min,
          communes_insee: p.insee_codes,
          equipements: p.features,
          cree_le: iso(p.created_at),
        })),
        rendez_vous: appointments.map((a) => ({
          type: a.kind,
          objet: a.title,
          debut: iso(a.starts_at),
          fin: iso(a.ends_at),
          lieu: a.location,
          notes: a.notes,
          statut: a.status === "annule" ? "annulé" : "prévu",
          compte_rendu: a.interest
            ? {
                interet: INTEREST_LABELS[a.interest as VisitInterest],
                avis_prix: a.price_opinion ? PRICE_OPINION_LABELS[a.price_opinion as PriceOpinion] : null,
                suite: NEXT_STEP_LABELS[a.next_step as VisitNextStep],
                points_apprecies: a.positives,
                reserves: a.objections,
              }
            : null,
        })),
        affaires: deals.map((d) => ({
          role: d.role,
          bien: d.address_label,
          etape: d.stage,
          prix: d.price === null ? null : Number(d.price),
          offre_acceptee_le: d.offer_accepted_on,
          compromis_signe_le: d.compromis_signed_on,
          acte_signe_le: d.deed_signed_on,
        })),
        taches: tasks.map((t) => ({
          titre: t.title,
          details: t.details,
          echeance: t.due_on,
          statut: t.status === "faite" ? "faite" : "à faire",
          creee_le: iso(t.created_at),
          terminee_le: iso(t.done_at),
        })),
      },
    };
  });
  if (result.status === "ok") {
    await audit({ orgId: ctx.org.id, userId: ctx.user.id, action: "contact.exporte", targetType: "contact", targetId: contactId });
  }
  return result;
}
