/**
 * Import de l'export « Poliris » (D-068) : le format que les logiciels de transaction utilisent
 * pour envoyer les annonces de l'agence à SeLoger (fichier Annonces.csv, champs entre guillemets
 * séparés par !#, un bien par ligne, sans en-tête). Ce sont les propres annonces de l'agence :
 * les importer est légal. Rangs des champs : spécification SeLoger version 4.09.
 *
 * Seules les ventes d'appartements et de maisons sont reprises (ImmoPilot ne gère pas encore la
 * location ni les autres types de biens).
 */
import { FEATURE_KEYS, type PropertyFeature } from "../matching/match";
import type { ImportRow, ParsedImport, PropertyDraft } from "./import";
import { IMPORT_MAX_ROWS } from "./import";

/** Rangs (à partir de 1) des champs utilisés, d'après la spécification. */
const RANK = {
  reference: 2, annonce: 3, typeBien: 4, cp: 5, ville: 6, adresse: 8, prix: 11, surface: 16, pieces: 18,
  libelle: 20, descriptif: 21, balcons: 39, ascenseur: 41, cave: 42, parkings: 43, terrasse: 48, exclusif: 83,
  dpe: 177,
} as const;

/** Une ligne au format Poliris commence par un guillemet et contient le séparateur "!#". */
export function isPolirisText(text: string): boolean {
  const first = text.replace(/^\uFEFF/, "").split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  return /^"[^"]*"!#"/.test(first.trim());
}

function splitLine(line: string): string[] {
  const t = line.trim().replace(/^"/, "").replace(/"$/, "");
  return t.split(/"\s*!#\s*"/);
}

const num = (raw: string | undefined): number | null => {
  const v = (raw ?? "").trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const yes = (raw: string | undefined) => (raw ?? "").trim().toUpperCase() === "OUI";
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function typeOf(raw: string): "Appartement" | "Maison" | null {
  const t = plain(raw);
  if (t === "appartement") return "Appartement";
  if (t === "maison" || t === "maison/villa" || t === "villa" || t === "maison avec terrain") return "Maison";
  return null;
}

export function parsePolirisCsv(text: string): ParsedImport<PropertyDraft, never> {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l, i) => ({ l, line: i + 1 })).filter(({ l }) => l.trim() !== "");
  const base = { columns: {}, unknownColumns: [] as string[] };
  if (!lines.length) return { ...base, rows: [], fatal: "Le fichier est vide." };
  if (lines.length > IMPORT_MAX_ROWS.properties) {
    return { ...base, rows: [], fatal: `Trop d'annonces (${lines.length}) : ${IMPORT_MAX_ROWS.properties} au maximum par import. Découpez le fichier.` };
  }
  const rows: ImportRow<PropertyDraft>[] = lines.map(({ l, line }) => {
    const f = splitLine(l);
    const get = (rank: number) => (f[rank - 1] ?? "").trim();
    const errors: string[] = [];
    if (f.length < RANK.descriptif) return { line, data: null, errors: ["Ligne incomplète : ce n'est pas une annonce au format Poliris."] };
    const ref = get(RANK.reference);
    const annonce = plain(get(RANK.annonce));
    if (!annonce.startsWith("vente")) return { line, data: null, errors: [`Annonce ${ref || "sans référence"} : « ${get(RANK.annonce)} » n'est pas une vente (seules les ventes sont reprises).`] };
    const type = typeOf(get(RANK.typeBien));
    if (!type) return { line, data: null, errors: [`Annonce ${ref || "sans référence"} : type « ${get(RANK.typeBien)} » non géré (appartements et maisons seulement).`] };
    const cp = get(RANK.cp);
    const ville = get(RANK.ville);
    const adresse = get(RANK.adresse);
    if (!adresse) errors.push(`Annonce ${ref || "sans référence"} : adresse absente (le logiciel ne l'a pas exportée), le bien ne peut pas être placé.`);
    const surface = num(get(RANK.surface));
    const rooms = num(get(RANK.pieces));
    const price = num(get(RANK.prix));
    const dpeRaw = get(RANK.dpe).toUpperCase();
    const features: PropertyFeature[] = [];
    if (yes(get(RANK.ascenseur))) features.push("ascenseur");
    if (yes(get(RANK.terrasse)) || (num(get(RANK.balcons)) ?? 0) > 0) features.push("balcon_terrasse");
    if (yes(get(RANK.cave))) features.push("cave");
    if ((num(get(RANK.parkings)) ?? 0) > 0) features.push("stationnement");
    if (errors.length) return { line, data: null, errors };
    const title = get(RANK.libelle).slice(0, 120) || null;
    const description = get(RANK.descriptif).replace(/<br\s*\/?>/gi, "\n").slice(0, 4000) || null;
    return {
      line,
      errors: [],
      data: {
        addressQuery: `${adresse} ${cp} ${ville}`.trim(),
        type,
        surface: surface !== null && surface >= 9 ? surface : null,
        rooms: rooms !== null && rooms >= 1 && rooms <= 50 ? Math.round(rooms) : null,
        price: price !== null && price >= 1000 ? Math.round(price) : null,
        dpeClass: /^[A-G]$/.test(dpeRaw) ? (dpeRaw as PropertyDraft["dpeClass"]) : null,
        status: "mandat",
        mandateType: yes(get(RANK.exclusif)) ? "exclusif" : "simple",
        mandateNumber: null,
        mandateSignedOn: null,
        mandateEndsOn: null,
        features: features.filter((k) => (FEATURE_KEYS as readonly string[]).includes(k)),
        notes: ref ? `Importé depuis le logiciel de l'agence (format Poliris), référence ${ref}.` : "Importé depuis le logiciel de l'agence (format Poliris).",
        listingTitle: title,
        listingDescription: description,
      },
    };
  });
  return { ...base, rows, fatal: null };
}
