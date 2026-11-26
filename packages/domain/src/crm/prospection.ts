/**
 * Prospection (D-072) : suivre les biens que l'agence veut rentrer en mandat (annonce de
 * particulier repérée, bouche-à-oreille, demande d'estimation en ligne), dans le CRM existant.
 */

export const PROSPECTION_STATUSES = [
  "a_contacter",
  "contacte",
  "en_attente",
  "relance",
  "rendez_vous",
  "mandat_obtenu",
  "sans_suite",
] as const;
export type ProspectionStatus = (typeof PROSPECTION_STATUSES)[number];

export const PROSPECTION_LABELS: Record<ProspectionStatus, string> = {
  a_contacter: "À contacter",
  contacte: "Contacté",
  en_attente: "En attente",
  relance: "Relance à effectuer",
  rendez_vous: "Rendez-vous obtenu",
  mandat_obtenu: "Mandat obtenu",
  sans_suite: "Sans suite",
};

/** Statuts terminés : le bien n'est plus « en cours » de prospection. */
const CLOSED: ReadonlySet<ProspectionStatus> = new Set(["mandat_obtenu", "sans_suite"]);
export const isProspectionClosed = (s: ProspectionStatus) => CLOSED.has(s);

export function isProspectionStatus(v: unknown): v is ProspectionStatus {
  return typeof v === "string" && (PROSPECTION_STATUSES as readonly string[]).includes(v);
}

/** Titre de la tâche de relance (repérée par ce début pour ne jamais la créer en double). */
export const FOLLOW_UP_PREFIX = "Relancer le propriétaire";
export const followUpTitle = (addressLabel: string) => `${FOLLOW_UP_PREFIX} : ${addressLabel}`.slice(0, 200);

/** Date de relance proposée (AAAA-MM-JJ) : dans 7 jours par défaut. */
export function defaultFollowUpOn(today: string, days = 7): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Effets d'un changement de statut : « Relance à effectuer » crée une tâche datée ; « Mandat
 * obtenu » passe le bien « sous mandat » s'il était encore prospect.
 */
export function prospectionEffects(to: ProspectionStatus, propertyStatus: string): { followUp: boolean; toMandate: boolean } {
  return { followUp: to === "relance", toMandate: to === "mandat_obtenu" && propertyStatus === "prospect" };
}

/**
 * Le statut du bien change par sa propre page : la prospection en cours suit. Mandat signé (ou
 * plus loin), c'est « Mandat obtenu » ; bien retiré, « Sans suite ». Sinon rien ne change.
 */
export function prospectionAfterPropertyStatus(current: ProspectionStatus | null, propertyStatus: string): ProspectionStatus | null {
  if (current === null || CLOSED.has(current)) return current;
  if (propertyStatus === "mandat" || propertyStatus === "sous_offre" || propertyStatus === "vendu") return "mandat_obtenu";
  if (propertyStatus === "retire") return "sans_suite";
  return current;
}

export interface ProspectLike {
  status: ProspectionStatus;
  favorite: boolean;
  /** Prochaine relance prévue (tâche ouverte), AAAA-MM-JJ. */
  followUpOn: string | null;
  updatedAt: Date;
}

/** Ordre de la liste : favoris, puis en cours avant terminés, puis relance la plus proche, puis le plus récent. */
export function sortProspects<T extends ProspectLike>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      Number(b.favorite) - Number(a.favorite) ||
      Number(CLOSED.has(a.status)) - Number(CLOSED.has(b.status)) ||
      (a.followUpOn ?? "9999-12-31").localeCompare(b.followUpOn ?? "9999-12-31") ||
      b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
}

export function prospectionCounts(statuses: readonly ProspectionStatus[]) {
  const byStatus = Object.fromEntries(PROSPECTION_STATUSES.map((s) => [s, 0])) as Record<ProspectionStatus, number>;
  for (const s of statuses) byStatus[s] += 1;
  return { total: statuses.length, open: statuses.filter((s) => !CLOSED.has(s)).length, byStatus };
}

export interface OwnerReachInput {
  /** Un contact vendeur est rattaché au bien et visible. */
  hasOwner: boolean;
  phone: string | null;
  email: string | null;
  /** Accords en cours de validité, enregistrés sur la fiche du contact. */
  phoneConsent: boolean;
  emailConsent: boolean;
}

/**
 * Comment joindre le propriétaire. Depuis le 11/08/2026, un professionnel ne peut appeler un
 * particulier pour lui proposer ses services sans son accord préalable ; l'e-mail de prospection
 * l'exige aussi. Un numéro publié dans une annonce ne vaut pas accord. Le courrier reste possible.
 */
export function ownerReach(input: OwnerReachInput): { call: boolean; email: boolean; message: string } {
  if (!input.hasOwner) {
    return { call: false, email: false, message: "Propriétaire pas encore enregistré : ajoutez-le comme contact vendeur du bien." };
  }
  const call = input.phoneConsent && !!input.phone;
  const email = input.emailConsent && !!input.email;
  if (call || email) {
    const ways = [call ? "par téléphone" : null, email ? "par e-mail" : null].filter(Boolean).join(" et ");
    return { call, email, message: `Accord enregistré : vous pouvez le contacter ${ways}.` };
  }
  return {
    call: false,
    email: false,
    message: "Aucun accord enregistré : ni appel ni e-mail de prospection. Écrivez-lui un courrier ou proposez une estimation, puis notez son accord sur sa fiche.",
  };
}

/**
 * Ajoute une note datée aux notes du bien (champ existant, 5 000 caractères au plus). Si la place
 * manque, les notes les plus anciennes sont retirées, ligne entière par ligne entière.
 */
export function appendNote(existing: string | null, note: string, author: string, day: string, max = 5000): string {
  const [y, m, d] = day.split("-");
  const line = `${d}/${m}/${y} · ${author.trim() || "Membre"} : ${note.trim().replace(/\s*\n\s*/g, " ")}`.slice(0, max);
  let lines = [...(existing?.trim() ? existing.trim().split("\n") : []), line];
  while (lines.length > 1 && lines.join("\n").length > max) lines = lines.slice(1);
  return lines.join("\n");
}

/** Dernière note (la plus récente), pour la liste de prospection. */
export function lastNote(notes: string | null): string | null {
  const lines = notes?.trim() ? notes.trim().split("\n") : [];
  return lines.length ? lines[lines.length - 1]! : null;
}
