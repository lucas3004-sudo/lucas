/**
 * Export complet des données de l'agence (réversibilité) : un fichier CSV par type, lisible par
 * Excel, aux colonnes reprises par l'import quand c'est possible. Réservé au gérant, avec la
 * double authentification active (un export complet est la cible n° 1 d'un compte volé).
 * Lecture sous l'identité du gérant : la RLS s'applique (le gérant voit toute l'agence).
 */
import { withTenant } from "@immopilot/db";
import { INTEREST_LABELS, NEXT_STEP_LABELS, PRICE_OPINION_LABELS, toCsv, type CsvCell, type PriceOpinion, type VisitInterest, type VisitNextStep } from "@immopilot/domain";
import type { AgencyContext } from "../agency/context";
import { APPOINTMENT_KINDS } from "../agenda/labels";
import { isoDay } from "../crm/dates";
import { CONSENT_CHANNELS, CONTACT_ROLES, PROFILE_STATUS, PROPERTY_STATUS } from "../crm/labels";
import { DEAL_STAGES } from "../deals/labels";
import { getTenantPool } from "../server/db";

export const EXPORT_DATASETS = {
  contacts: "Contacts",
  biens: "Biens de l'agence",
  profils: "Profils de recherche",
  consentements: "Consentements",
  taches: "Tâches",
  rendezvous: "Rendez-vous",
  affaires: "Affaires",
  visites: "Comptes rendus de visite",
} as const;
export type ExportDataset = keyof typeof EXPORT_DATASETS;

export function isExportDataset(v: string): v is ExportDataset {
  return Object.hasOwn(EXPORT_DATASETS, v);
}

const label = <T extends Record<string, string>>(map: T, v: unknown) => (typeof v === "string" ? (map[v] ?? v) : null);
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const parisDateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });
const at = (v: unknown) => (v instanceof Date ? parisDateTime.format(v) : null);
const day = (v: unknown) => {
  const iso = isoDay(v);
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : null; // JJ/MM/AAAA, comme l'import
};

export async function exportDataset(ctx: AgencyContext, dataset: ExportDataset, memberNames: Map<string, string>): Promise<{ csv: string; rows: number }> {
  const who = (id: unknown) => (typeof id === "string" ? (memberNames.get(id) ?? "Ancien membre") : null);
  const rows: CsvCell[][] = await withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) => {
    const q = async (sql: string) => (await c.query(sql)).rows as Record<string, unknown>[];
    switch (dataset) {
      case "contacts":
        return [
          ["Prénom", "Nom", "E-mail", "Téléphone", "Rôles", "Visibilité", "Responsable", "Source", "Notes", "Créé le"],
          ...(await q("SELECT * FROM app.contacts ORDER BY created_at")).map((r) => [
            r.first_name as string, r.last_name as string, r.email as string, r.phone as string,
            (r.roles as string[]).map((x) => label(CONTACT_ROLES, x)).join(", "), r.visibility === "private" ? "Privé" : "Agence",
            who(r.owner_user_id), r.source as string, r.notes as string, at(r.created_at),
          ]),
        ];
      case "biens":
        return [
          ["Adresse", "Type", "Surface", "Pièces", "Prix", "DPE", "Statut", "Mandat", "N° mandat", "Date de mandat", "Fin du mandat", "Équipements", "Visibilité", "Responsable", "Notes", "Créé le"],
          ...(await q("SELECT * FROM app.properties ORDER BY created_at")).map((r) => [
            r.address_label as string, r.type as string, num(r.surface), num(r.rooms), num(r.price), r.dpe_class as string,
            label(PROPERTY_STATUS, r.status), r.mandate_type as string, r.mandate_number as string, day(r.mandate_signed_on), day(r.mandate_ends_on),
            (r.features as string[]).join(", "), r.visibility === "private" ? "Privé" : "Agence", who(r.owner_user_id), r.notes as string, at(r.created_at),
          ]),
        ];
      case "profils":
        return [
          ["Contact", "Statut", "Types", "Budget maximum", "Surface minimum", "Pièces minimum", "Communes (INSEE)", "Équipements", "Responsable", "Créé le"],
          ...(await q(`SELECT p.*, concat_ws(' ', ct.first_name, ct.last_name) AS contact FROM app.buyer_profiles p
                       LEFT JOIN app.contacts ct ON ct.id = p.contact_id ORDER BY p.created_at`)).map((r) => [
            r.contact as string, label(PROFILE_STATUS, r.status), (r.types as string[]).join(", "), num(r.budget_max), num(r.surface_min), num(r.rooms_min),
            (r.insee_codes as string[]).join(", "), (r.features as string[]).join(", "), who(r.owner_user_id), at(r.created_at),
          ]),
        ];
      case "consentements":
        return [
          ["Contact", "Canal", "Décision", "Recueilli le", "Expire le", "Preuve", "Enregistré par", "Enregistré le"],
          ...(await q(`SELECT x.*, concat_ws(' ', ct.first_name, ct.last_name) AS contact FROM app.contact_consents x
                       LEFT JOIN app.contacts ct ON ct.id = x.contact_id ORDER BY x.recorded_at`)).map((r) => [
            r.contact as string, label(CONSENT_CHANNELS, r.channel), r.status === "accorde" ? "Accordé" : "Retiré",
            day(r.obtained_at), day(r.expires_at), r.proof as string, who(r.recorded_by), at(r.recorded_at),
          ]),
        ];
      case "taches":
        return [
          ["Tâche", "Détails", "Échéance", "Statut", "Attribuée à", "Contact", "Bien", "Créée le", "Faite le"],
          ...(await q(`SELECT t.*, concat_ws(' ', ct.first_name, ct.last_name) AS contact, p.address_label AS bien FROM app.tasks t
                       LEFT JOIN app.contacts ct ON ct.id = t.contact_id LEFT JOIN app.properties p ON p.id = t.property_id ORDER BY t.created_at`)).map((r) => [
            r.title as string, r.details as string, day(r.due_on), r.status === "faite" ? "Faite" : "À faire", who(r.assignee_user_id),
            (r.contact as string) || null, r.bien as string, at(r.created_at), at(r.done_at),
          ]),
        ];
      case "rendezvous":
        return [
          ["Type", "Objet", "Début", "Fin", "Lieu", "Notes", "Statut", "Organisateur", "Contact", "Bien"],
          ...(await q(`SELECT a.*, concat_ws(' ', ct.first_name, ct.last_name) AS contact, p.address_label AS bien FROM app.appointments a
                       LEFT JOIN app.contacts ct ON ct.id = a.contact_id LEFT JOIN app.properties p ON p.id = a.property_id ORDER BY a.starts_at`)).map((r) => [
            label(APPOINTMENT_KINDS, r.kind), r.title as string, at(r.starts_at), at(r.ends_at), r.location as string, r.notes as string,
            r.status === "annule" ? "Annulé" : "Prévu", who(r.organizer_user_id), (r.contact as string) || null, r.bien as string,
          ]),
        ];
      case "affaires":
        return [
          ["Bien", "Étape", "Prix", "Honoraires", "Offre acceptée le", "Compromis signé le", "Rétractation notifiée le", "Fin de la condition de prêt", "Acte prévu le", "Acte signé le", "Notaire", "Acquéreur", "Vendeur", "Responsable", "Notes"],
          ...(await q(`SELECT d.*, p.address_label AS bien, concat_ws(' ', b.first_name, b.last_name) AS acquereur, concat_ws(' ', s.first_name, s.last_name) AS vendeur
                       FROM app.deals d JOIN app.properties p ON p.id = d.property_id
                       LEFT JOIN app.contacts b ON b.id = d.buyer_contact_id LEFT JOIN app.contacts s ON s.id = d.seller_contact_id ORDER BY d.created_at`)).map((r) => [
            r.bien as string, label(DEAL_STAGES, r.stage), num(r.price), num(r.fees), day(r.offer_accepted_on), day(r.compromis_signed_on),
            day(r.retraction_notified_on), day(r.loan_deadline), day(r.deed_planned_on), day(r.deed_signed_on), r.notary as string,
            (r.acquereur as string) || null, (r.vendeur as string) || null, who(r.owner_user_id), r.notes as string,
          ]),
        ];
      case "visites":
        return [
          ["Visite du", "Objet", "Bien", "Intérêt", "Avis sur le prix", "Suite envisagée", "Points appréciés", "Réserves", "Auteur"],
          ...(await q(`SELECT vr.*, a.starts_at, a.title, p.address_label AS bien FROM app.visit_reports vr
                       LEFT JOIN app.appointments a ON a.id = vr.appointment_id LEFT JOIN app.properties p ON p.id = vr.property_id ORDER BY a.starts_at`)).map((r) => [
            at(r.starts_at), r.title as string, r.bien as string, INTEREST_LABELS[r.interest as VisitInterest],
            r.price_opinion ? PRICE_OPINION_LABELS[r.price_opinion as PriceOpinion] : null, NEXT_STEP_LABELS[r.next_step as VisitNextStep],
            r.positives as string, r.objections as string, who(r.author_user_id),
          ]),
        ];
    }
  });
  return { csv: `\uFEFF${toCsv(rows)}`, rows: rows.length - 1 };
}
