/**
 * Photos des biens : contrôle du format réel (octets, pas l'extension) et suppression des
 * métadonnées (EXIF, dont la position GPS du téléphone, commentaires, XMP). Fonctions pures.
 * Seuls JPEG et PNG sont acceptés : jamais de SVG ni d'autre format pouvant contenir du script.
 */

export type ImageType = "image/jpeg" | "image/png";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return "image/png";
  return null;
}

export class InvalidImageError extends Error {}

/**
 * JPEG : retire les segments APP1 à APP15 (EXIF, XMP, ICC…) et COM (commentaires).
 * APP0 (JFIF) est conservé. Tout ce qui suit le début des données (SOS) est recopié tel quel.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (detectImageType(bytes) !== "image/jpeg") throw new InvalidImageError("Pas un JPEG.");
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new InvalidImageError("JPEG malformé.");
    // Octets de remplissage 0xFF consécutifs.
    while (bytes[i + 1] === 0xff) i++;
    const marker = bytes[i + 1]!;
    if (marker === 0xd9) {
      out.push(0xff, 0xd9);
      return Uint8Array.from(out);
    }
    if (marker === 0xda) {
      // Début des données compressées : on recopie tout le reste.
      for (let j = i; j < bytes.length; j++) out.push(bytes[j]!);
      return Uint8Array.from(out);
    }
    if (i + 3 >= bytes.length) throw new InvalidImageError("JPEG tronqué.");
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (length < 2 || i + 2 + length > bytes.length) throw new InvalidImageError("Segment JPEG invalide.");
    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadata) for (let j = i; j < i + 2 + length; j++) out.push(bytes[j]!);
    i += 2 + length;
  }
  throw new InvalidImageError("JPEG sans fin.");
}

const PNG_METADATA_CHUNKS = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME"]);

/** PNG : retire les blocs de texte, EXIF et date (tEXt, iTXt, zTXt, eXIf, tIME). */
export function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  if (detectImageType(bytes) !== "image/png") throw new InvalidImageError("Pas un PNG.");
  const out: number[] = PNG_SIGNATURE.slice();
  let i = 8;
  while (i + 8 <= bytes.length) {
    const length = ((bytes[i]! << 24) | (bytes[i + 1]! << 16) | (bytes[i + 2]! << 8) | bytes[i + 3]!) >>> 0;
    const type = String.fromCharCode(bytes[i + 4]!, bytes[i + 5]!, bytes[i + 6]!, bytes[i + 7]!);
    const end = i + 12 + length;
    if (end > bytes.length) throw new InvalidImageError("Bloc PNG invalide.");
    if (!PNG_METADATA_CHUNKS.has(type)) for (let j = i; j < end; j++) out.push(bytes[j]!);
    i = end;
    if (type === "IEND") return Uint8Array.from(out);
  }
  throw new InvalidImageError("PNG sans fin.");
}

/** Largeur et hauteur lues dans l'en-tête (JPEG : premier segment SOF ; PNG : IHDR). */
export function imageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const type = detectImageType(bytes);
  if (type === "image/png") {
    if (bytes.length < 24) return null;
    const read = (o: number) => ((bytes[o]! << 24) | (bytes[o + 1]! << 16) | (bytes[o + 2]! << 8) | bytes[o + 3]!) >>> 0;
    return { width: read(16), height: read(20) };
  }
  if (type === "image/jpeg") {
    let i = 2;
    while (i + 9 < bytes.length && bytes[i] === 0xff) {
      const marker = bytes[i + 1]!;
      const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { height: (bytes[i + 5]! << 8) | bytes[i + 6]!, width: (bytes[i + 7]! << 8) | bytes[i + 8]! };
      if (marker === 0xda) return null;
      i += 2 + length;
    }
  }
  return null;
}

/** Contrôle complet : format reconnu, métadonnées retirées, dimensions lisibles et raisonnables. */
export function sanitizeImage(bytes: Uint8Array): { type: ImageType; bytes: Uint8Array; width: number; height: number } {
  const type = detectImageType(bytes);
  if (!type) throw new InvalidImageError("Format non accepté : JPEG ou PNG uniquement.");
  const clean = type === "image/jpeg" ? stripJpegMetadata(bytes) : stripPngMetadata(bytes);
  const dims = imageDimensions(clean);
  if (!dims || dims.width < 1 || dims.height < 1 || dims.width > 8000 || dims.height > 8000) {
    throw new InvalidImageError("Dimensions de l'image illisibles ou hors limites.");
  }
  return { type, bytes: clean, ...dims };
}
