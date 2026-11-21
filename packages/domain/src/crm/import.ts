/**
 * Import CSV des contacts et des biens (critères F4 et F5). Fonctions pures :
 * - décodage UTF-8 ou Windows-1252 (exports Excel français), séparateur détecté ;
 * - colonnes reconnues par synonymes (« Prénom », « first name », « Courriel »…) ;
 * - chaque ligne est validée ; une ligne invalide est signalée, jamais corrigée en silence.
 * Les consentements de prospection ne sont JAMAIS importés : ils exigent une preuve par contact.
 */
import { parseCsv } from "../csv";
import { FEATURE_KEYS, type PropertyFeature } from "../matching/match";
import { normalizeEmail, normalizePhone } from "./duplicates";

export const IMPORT_MAX_ROWS = { contacts: 2000, properties: 200 } as const;

/** Octets d'un fichier → texte : UTF-8 si valide, sinon Windows-1252 (Excel « CSV (séparateur : point-virgule) »). */
export function decodeCsvBytes(bytes: Uint8Array): { text: string; encoding: "utf-8" | "windows-1252" } {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { text: text.replace(/^\uFEFF/, ""), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(bytes), encoding: "windows-1252" };
  }
}

/** Séparateur le plus fréquent sur la ligne d'en-tête (hors guillemets) : « ; », « , » ou tabulation. */
export function detectSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const unquoted = firstLine.replace(/"[^"]*"/g, "");
  const counts = [";", ",", "\t"].map((sep) => ({ sep, n: unquoted.split(sep).length - 1 }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0]!.n > 0 ? counts[0]!.sep : ";";
}

/** « Prénom » → « prenom » ; « E-mail » → « email » ; « Surface (m²) » → « surfacem2 ». */
export function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/²/g, "2")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Nombre écrit à la française : « 250 000 », « 62,5 », « 250 000,00 € ». Null si vide ; NaN si illisible. */
export function parseFrenchNumber(raw: string): number | null {
  const s = raw.replace(/[\s\u00a0\u202f€]/g, "").replace(/m2$/i, "");
  if (s === "") return null;
  const normalized = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

const plain = (v: string) => normalizeHeader(v);

type ColumnSpec<K extends string> = Record<K, readonly string[]>;

function mapColumns<K extends string>(header: string[], spec: ColumnSpec<K>) {
  const columns = {} as Partial<Record<K, number>>;
  const unknown: string[] = [];
  header.forEach((name, index) => {
    const key = (Object.keys(spec) as K[]).find((k) => spec[k].includes(normalizeHeader(name)));
    if (key && columns[key] === undefined) columns[key] = index;
    else if (name.trim()) unknown.push(name.trim());
  });
  return { columns, unknown };
}

export interface ImportRow<T> {
  /** Numéro de ligne dans le fichier (l'en-tête est la ligne 1). */
  line: number;
  data: T | null;
  errors: string[];
}

export interface ParsedImport<T, K extends string> {
  columns: Partial<Record<K, string>>;
  unknownColumns: string[];
  rows: ImportRow<T>[];
  /** Erreur bloquante (fichier vide, colonne obligatoire absente, trop de lignes). */
  fatal: string | null;
}

function parseTable<T, K extends string>(
  text: string,
  spec: ColumnSpec<K>,
  required: NoInfer<K>[],
  maxRows: number,
  toRow: (get: (k: K) => string, errors: string[]) => T | null,
): ParsedImport<T, K> {
  const table = parseCsv(text, detectSeparator(text)).filter((r) => r.some((cell) => cell.trim() !== ""));
  const [header, ...body] = table;
  if (!header) return { columns: {}, unknownColumns: [], rows: [], fatal: "Le fichier est vide." };
  const { columns, unknown } = mapColumns(header, spec);
  const names = Object.fromEntries(Object.entries(columns).map(([k, i]) => [k, header[i as number]!.trim()])) as Partial<Record<K, string>>;
  const missing = required.filter((k) => columns[k] === undefined);
  if (missing.length) {
    return { columns: names, unknownColumns: unknown, rows: [], fatal: `Colonne obligatoire absente : ${missing.join(", ")}.` };
  }
  if (body.length === 0) return { columns: names, unknownColumns: unknown, rows: [], fatal: "Aucune ligne de données sous l'en-tête." };
  if (body.length > maxRows) {
    return { columns: names, unknownColumns: unknown, rows: [], fatal: `Trop de lignes (${body.length}) : ${maxRows} au maximum par import.` };
  }
  const rows = body.map((cells, i) => {
    const get = (k: K) => (columns[k] === undefined ? "" : (cells[columns[k]!] ?? "").trim());
    const errors: string[] = [];
    const data = toRow(get, errors);
    return { line: i + 2, data: errors.length ? null : data, errors };
  });
  return { columns: names, unknownColumns: unknown, rows, fatal: null };
}

// --- Contacts -----------------------------------------------------------------------------

export type ImportContactRole = "acquereur" | "vendeur" | "investisseur" | "bailleur" | "locataire" | "autre";

export interface ContactDraft {
  firstName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
  roles: ImportContactRole[];
  source: string | null;
  notes: string | null;
}

const CONTACT_COLUMNS = {
  prenom: ["prenom", "firstname", "givenname"],
  nom: ["nom", "lastname", "nomdefamille", "familyname", "surname"],
  email: ["email", "mail", "courriel", "adresseemail", "adressemail", "emailaddress"],
  telephone: ["telephone", "tel", "phone", "mobile", "portable", "telephonemobile", "numerodetelephone"],
  roles: ["role", "roles", "type", "typedecontact", "categorie"],
  source: ["source", "origine", "provenance"],
  notes: ["notes", "note", "commentaire", "commentaires", "remarques"],
} as const satisfies ColumnSpec<string>;
type ContactColumn = keyof typeof CONTACT_COLUMNS;

const ROLE_SYNONYMS: Record<string, ImportContactRole> = {
  acquereur: "acquereur", acheteur: "acquereur",
  vendeur: "vendeur",
  investisseur: "investisseur",
  bailleur: "bailleur", proprietaire: "bailleur", proprietairebailleur: "bailleur",
  locataire: "locataire",
  autre: "autre",
};

export function parseContactsCsv(text: string): ParsedImport<ContactDraft, ContactColumn> {
  return parseTable(text, CONTACT_COLUMNS, ["nom"], IMPORT_MAX_ROWS.contacts, (get, errors) => {
    const lastName = get("nom");
    if (!lastName) errors.push("Nom manquant.");
    if (lastName.length > 120) errors.push("Nom trop long (120 caractères au maximum).");
    const firstName = get("prenom") || null;
    if (firstName && firstName.length > 80) errors.push("Prénom trop long (80 caractères au maximum).");
    const emailRaw = get("email");
    const email = emailRaw ? normalizeEmail(emailRaw) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null : null;
    if (emailRaw && !email) errors.push(`E-mail invalide : « ${emailRaw} ».`);
    const phoneRaw = get("telephone");
    const phone = phoneRaw ? (normalizePhone(phoneRaw) ? phoneRaw : null) : null;
    if (phoneRaw && !phone) errors.push(`Téléphone invalide : « ${phoneRaw} ».`);
    const roles: ImportContactRole[] = [];
    for (const part of get("roles").split(/[,/;|]+/).map(plain).filter(Boolean)) {
      const role = ROLE_SYNONYMS[part];
      if (role) {
        if (!roles.includes(role)) roles.push(role);
      } else errors.push(`Rôle inconnu : « ${part} » (acquéreur, vendeur, investisseur, bailleur, locataire, autre).`);
    }
    const notes = get("notes") || null;
    if (notes && notes.length > 5000) errors.push("Notes trop longues (5 000 caractères au maximum).");
    return { firstName, lastName, email, phone, roles, source: get("source").slice(0, 120) || null, notes };
  });
}

// --- Biens ----------------------------------------------------------------------------------

export type ImportPropertyStatus = "prospect" | "mandat" | "sous_offre" | "vendu" | "retire";

export interface PropertyDraft {
  /** Adresse à géocoder (adresse + code postal + ville). */
  addressQuery: string;
  type: "Appartement" | "Maison";
  surface: number | null;
  rooms: number | null;
  price: number | null;
  dpeClass: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;
  status: ImportPropertyStatus;
  mandateType: "simple" | "exclusif" | null;
  features: PropertyFeature[];
  notes: string | null;
}

const PROPERTY_COLUMNS = {
  adresse: ["adresse", "address", "adressedubien", "rue"],
  codepostal: ["codepostal", "cp", "postcode", "zipcode"],
  ville: ["ville", "commune", "city", "localite"],
  type: ["type", "typedebien", "typedebiens", "nature"],
  surface: ["surface", "surfacehabitable", "surfacem2", "m2", "superficie"],
  pieces: ["pieces", "nbpieces", "nombredepieces", "piecesprincipales"],
  prix: ["prix", "price", "prixdevente", "prixaffiche", "prixfai"],
  dpe: ["dpe", "classedpe", "etiquetteenergie", "classeenergie"],
  statut: ["statut", "status", "etat"],
  mandat: ["mandat", "typedemandat"],
  equipements: ["equipements", "equipement", "atouts"],
  notes: ["notes", "note", "commentaire", "commentaires", "description"],
} as const satisfies ColumnSpec<string>;
type PropertyColumn = keyof typeof PROPERTY_COLUMNS;

const STATUS_SYNONYMS: Record<string, ImportPropertyStatus> = {
  prospect: "prospect", estimation: "prospect", aestimer: "prospect",
  mandat: "mandat", sousmandat: "mandat", enmandat: "mandat", envente: "mandat", disponible: "mandat",
  sousoffre: "sous_offre", offre: "sous_offre", souscompromis: "sous_offre", compromis: "sous_offre",
  vendu: "vendu",
  retire: "retire", retiredelavente: "retire",
};

const FEATURE_SYNONYMS: Record<string, PropertyFeature> = {
  ...Object.fromEntries(FEATURE_KEYS.map((k) => [plain(k), k])),
  balcon: "balcon_terrasse", terrasse: "balcon_terrasse", balconterrasse: "balcon_terrasse",
  parking: "stationnement", garage: "stationnement", place: "stationnement",
  plainpied: "plain_pied",
};

export function parsePropertiesCsv(text: string): ParsedImport<PropertyDraft, PropertyColumn> {
  return parseTable(text, PROPERTY_COLUMNS, ["adresse", "type"], IMPORT_MAX_ROWS.properties, (get, errors) => {
    const addressQuery = [get("adresse"), get("codepostal"), get("ville")].filter(Boolean).join(" ").replace(/\s+/g, " ");
    if (addressQuery.length < 5) errors.push("Adresse manquante ou trop courte.");
    const t = plain(get("type"));
    const type = t.startsWith("appart") || t === "studio" || t === "duplex" ? "Appartement" : t.startsWith("maison") || t === "villa" ? "Maison" : null;
    if (!type) errors.push(`Type de bien non pris en charge : « ${get("type")} » (appartement ou maison).`);

    const num = (k: PropertyColumn, label: string, min: number, max: number, integer = false) => {
      const v = parseFrenchNumber(get(k));
      if (v === null) return null;
      if (Number.isNaN(v) || v < min || v > max || (integer && !Number.isInteger(v))) {
        errors.push(`${label} invalide : « ${get(k)} ».`);
        return null;
      }
      return v;
    };
    const surface = num("surface", "Surface", 9, 2000);
    const rooms = num("pieces", "Nombre de pièces", 1, 30, true);
    const price = num("prix", "Prix", 1000, 100_000_000);

    const dpeRaw = get("dpe").toUpperCase();
    const dpeClass = /^[A-G]$/.test(dpeRaw) ? (dpeRaw as PropertyDraft["dpeClass"]) : null;
    if (dpeRaw && !dpeClass) errors.push(`Classe DPE invalide : « ${get("dpe")} » (A à G).`);

    const statusRaw = plain(get("statut"));
    const status = statusRaw ? STATUS_SYNONYMS[statusRaw] : "mandat";
    if (!status) errors.push(`Statut inconnu : « ${get("statut")} » (prospect, mandat, sous offre, vendu, retiré).`);

    const mandateRaw = plain(get("mandat"));
    const mandateType = mandateRaw.includes("exclusif") ? "exclusif" : mandateRaw.includes("simple") ? "simple" : null;
    if (mandateRaw && !mandateType) errors.push(`Type de mandat inconnu : « ${get("mandat")} » (simple ou exclusif).`);

    const features: PropertyFeature[] = [];
    for (const part of get("equipements").split(/[,/;|]+/).map(plain).filter(Boolean)) {
      const f = FEATURE_SYNONYMS[part];
      if (f) {
        if (!features.includes(f)) features.push(f);
      } else errors.push(`Équipement non reconnu : « ${part} ».`);
    }
    const notes = get("notes") || null;
    if (notes && notes.length > 5000) errors.push("Notes trop longues (5 000 caractères au maximum).");

    return type && status
      ? { addressQuery, type, surface, rooms, price, dpeClass, status, mandateType, features, notes }
      : null;
  });
}
