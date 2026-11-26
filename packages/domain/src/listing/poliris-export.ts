/**
 * Export des annonces au format SeLoger « Poliris » (D-070), version 4.09 : le fichier que les
 * portails (SeLoger, Logic-Immo…) et les passerelles (Ubiflow…) reçoivent des logiciels d'agence.
 * Un ZIP contient Annonces.csv (329 champs par ligne, entre guillemets, séparés par !#),
 * Config.txt, Photos.cfg et les photos. L'adresse est transmise au portail (placement du bien),
 * comme le font les logiciels d'agence ; c'est le portail qui décide de ce qu'il affiche.
 */
import type { PropertyFeature } from "../matching/match";

export const POLIRIS_FIELD_COUNT = 329;
export const POLIRIS_VERSION = "4.09";

export interface PolirisListing {
  /** Identifiant de l'agence chez le portail (fourni par lui lors de l'activation). */
  agencyCode: string;
  /** Référence de l'annonce pour l'agence (20 caractères au plus). */
  reference: string;
  /** Identifiant technique unique (30 caractères au plus). */
  technicalId: string;
  type: "Appartement" | "Maison";
  /** Numéro et rue (sans code postal ni ville). */
  street: string;
  postcode: string;
  city: string;
  price: number;
  feesPayer: "acquereur" | "vendeur" | null;
  feesPercent: number | null;
  priceExcludingFees: number | null;
  surface: number | null;
  rooms: number | null;
  title: string;
  description: string;
  features: readonly PropertyFeature[];
  exclusive: boolean;
  dpeClass: string | null;
  gesClass: string | null;
  isCopro: boolean | null;
  coproLots: number | null;
  coproAnnualCharges: number | null;
  /** Noms des fichiers photos joints dans le ZIP, dans l'ordre. */
  photos: readonly string[];
}

/** Valeur conforme : pas de guillemet (remplacé par une apostrophe), sauts de ligne en <BR>, pas d'autre balise. */
export function polirisValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/"/g, "'").replace(/\r\n|\r|\n/g, "<BR>").replace(/<(?!BR>)[^>]*>/gi, "").trim();
}

const yesNo = (b: boolean | null | undefined) => (b ? "OUI" : "NON");
const decimal = (n: number | null) => (n === null ? "" : String(Math.round(n * 100) / 100));

/** Les 329 champs d'une annonce (rangs de la spécification, à partir de 1). */
export function polirisFields(l: PolirisListing): string[] {
  const f: string[] = Array.from({ length: POLIRIS_FIELD_COUNT }, () => "");
  const set = (rank: number, v: string | number | null | undefined) => {
    f[rank - 1] = polirisValue(v);
  };
  set(1, l.agencyCode.slice(0, 16));
  set(2, l.reference.slice(0, 20));
  set(3, "Vente");
  set(4, l.type === "Maison" ? "Maison/villa" : "Appartement");
  set(5, l.postcode);
  set(6, l.city.slice(0, 50));
  set(7, "France");
  set(8, l.street.slice(0, 128));
  set(11, l.price);
  if (l.feesPayer === "acquereur" && l.feesPercent !== null) set(15, decimal(l.feesPercent));
  set(16, decimal(l.surface));
  set(18, l.rooms);
  set(20, l.title.slice(0, 64));
  set(21, l.description.slice(0, 4000));
  set(41, yesNo(l.features.includes("ascenseur")));
  set(42, yesNo(l.features.includes("cave")));
  if (l.features.includes("stationnement")) set(43, 1);
  set(48, yesNo(l.features.includes("balcon_terrasse")));
  set(83, yesNo(l.exclusive));
  l.photos.slice(0, 30).forEach((name, i) => set(i < 9 ? 85 + i : 164 + (i - 9), name));
  set(175, l.technicalId.slice(0, 30));
  set(177, l.dpeClass);
  set(179, l.gesClass);
  set(258, yesNo(l.isCopro));
  if (l.isCopro) {
    set(259, l.coproLots);
    set(260, l.coproAnnualCharges);
  }
  set(301, POLIRIS_VERSION);
  if (l.feesPayer) set(302, l.feesPayer === "acquereur" ? "1" : "2");
  if (l.feesPayer === "acquereur") set(303, l.priceExcludingFees);
  return f;
}

/** Une ligne de Annonces.csv. */
export function polirisLine(l: PolirisListing): string {
  return polirisFields(l).map((v) => `"${v}"`).join("!#");
}

/** Contenu de Annonces.csv : une annonce par ligne, fins de ligne CRLF. */
export function polirisCsv(listings: readonly PolirisListing[]): string {
  return listings.map(polirisLine).join("\r\n") + (listings.length ? "\r\n" : "");
}

export const polirisConfig = (appVersion: string) => `Version=${POLIRIS_VERSION}\r\nApplication=ImmoPilot / ${appVersion}\r\nDevise=Euro\r\n`;
/** Les photos sont jointes dans chaque envoi. */
export const POLIRIS_PHOTOS_CFG = "Mode=FULL\r\n";

const CP1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89,
  0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
  0x202f: 0xa0, 0x2009: 0x20,
};

/** Encodage Windows-1252 (habituel des flux Poliris) ; un caractère hors table devient « ? ». */
export function encodeWindows1252(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80 || (c >= 0xa0 && c <= 0xff)) out.push(c);
    else out.push(CP1252[c] ?? 0x3f);
  }
  return Uint8Array.from(out);
}
