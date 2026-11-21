/**
 * Contrôle de la qualité des données du CRM (agent « Qualité des données », mode déterministe).
 * Fonctions pures : elles signalent, ne corrigent jamais seules.
 */
import { normalizeEmail, normalizeName, normalizePhone } from "./duplicates";

export interface QualityContact {
  id: string;
  firstName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
}

/**
 * Groupes de doublons probables : contacts partageant un e-mail, un téléphone ou un nom complet
 * (prénom et nom). Un contact n'apparaît que dans un groupe (le premier critère trouvé).
 */
export function duplicateGroups(contacts: readonly QualityContact[]): Array<{ reason: "email" | "telephone" | "nom"; ids: string[] }> {
  const groups: Array<{ reason: "email" | "telephone" | "nom"; ids: string[] }> = [];
  const used = new Set<string>();
  const keyed: Array<["email" | "telephone" | "nom", (c: QualityContact) => string | null]> = [
    ["email", (c) => normalizeEmail(c.email)],
    ["telephone", (c) => normalizePhone(c.phone)],
    ["nom", (c) => {
      const n = normalizeName(c.firstName, c.lastName);
      return n.includes(" ") ? n : null;
    }],
  ];
  for (const [reason, key] of keyed) {
    const buckets = new Map<string, string[]>();
    for (const c of contacts) {
      if (used.has(c.id)) continue;
      const k = key(c);
      if (k) buckets.set(k, [...(buckets.get(k) ?? []), c.id]);
    }
    for (const ids of buckets.values()) {
      if (ids.length < 2) continue;
      groups.push({ reason, ids });
      ids.forEach((id) => used.add(id));
    }
  }
  return groups;
}

export interface ConsentRecord {
  contactId: string;
  channel: string;
  status: "accorde" | "retire";
  expiresAt: string | null;
  recordedAt: Date;
}

/** Contacts sans AUCUN consentement de prospection valide aujourd'hui (la dernière décision par canal fait foi). */
export function contactsWithoutValidConsent(contactIds: readonly string[], consents: readonly ConsentRecord[], today: string): string[] {
  const latest = new Map<string, ConsentRecord>();
  for (const c of [...consents].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())) {
    const key = `${c.contactId}|${c.channel}`;
    if (!latest.has(key)) latest.set(key, c);
  }
  const valid = new Set(
    [...latest.values()].filter((c) => c.status === "accorde" && (!c.expiresAt || c.expiresAt >= today)).map((c) => c.contactId),
  );
  return contactIds.filter((id) => !valid.has(id));
}
