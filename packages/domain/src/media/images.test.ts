import { describe, expect, it } from "vitest";
import { detectImageType, imageDimensions, InvalidImageError, sanitizeImage, stripJpegMetadata, stripPngMetadata } from "./images";

const seg = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** JPEG minimal : APP0 (JFIF), APP1 (EXIF avec « GPS »), COM, SOF0 640×480, SOS + données, EOI. */
function jpeg(): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8,
    ...seg(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...seg(0xe1, [...ascii("Exif"), 0, 0, ...ascii("GPS 49.89N 2.30E")]),
    ...seg(0xfe, ascii("commentaire privé")),
    ...seg(0xc0, [8, 0x01, 0xe0, 0x02, 0x80, 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1]),
    ...seg(0xda, [3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0]),
    0x12, 0x34, 0x56,
    0xff, 0xd9,
  ]);
}

const chunk = (type: string, data: number[]) => [0, 0, data.length >> 8, data.length & 0xff, ...ascii(type), ...data, 0, 0, 0, 0];
/** PNG minimal : IHDR 1200×800, tEXt (auteur), eXIf, IDAT, IEND (CRC non vérifiés ici). */
function png(): Uint8Array {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk("IHDR", [0, 0, 0x04, 0xb0, 0, 0, 0x03, 0x20, 8, 2, 0, 0, 0]),
    ...chunk("tEXt", ascii("Author\0Jean Dupont")),
    ...chunk("eXIf", ascii("GPS")),
    ...chunk("IDAT", [1, 2, 3]),
    ...chunk("IEND", []),
  ]);
}

const contains = (bytes: Uint8Array, text: string) => new TextDecoder("latin1").decode(bytes).includes(text);

describe("photos des biens", () => {
  it("reconnaît le format réel par ses octets ; refuse SVG, HTML et GIF", () => {
    expect(detectImageType(jpeg())).toBe("image/jpeg");
    expect(detectImageType(png())).toBe("image/png");
    for (const bad of ["<svg xmlns=", "<html>", "GIF89a"]) expect(detectImageType(new TextEncoder().encode(bad))).toBeNull();
  });

  it("JPEG : retire l'EXIF (position GPS) et les commentaires, garde l'image", () => {
    const clean = stripJpegMetadata(jpeg());
    expect(contains(jpeg(), "GPS")).toBe(true);
    expect(contains(clean, "GPS")).toBe(false);
    expect(contains(clean, "commentaire")).toBe(false);
    expect(contains(clean, "JFIF")).toBe(true);
    expect(Array.from(clean.slice(-5))).toEqual([0x12, 0x34, 0x56, 0xff, 0xd9]);
    expect(imageDimensions(clean)).toEqual({ width: 640, height: 480 });
  });

  it("PNG : retire les blocs texte et EXIF, garde IHDR, IDAT et IEND", () => {
    const clean = stripPngMetadata(png());
    expect(contains(clean, "Jean Dupont")).toBe(false);
    expect(contains(clean, "eXIf")).toBe(false);
    expect(contains(clean, "IDAT")).toBe(true);
    expect(imageDimensions(clean)).toEqual({ width: 1200, height: 800 });
  });

  it("refuse un fichier tronqué ou d'un autre format", () => {
    expect(() => sanitizeImage(jpeg().slice(0, 12))).toThrow(InvalidImageError);
    expect(() => sanitizeImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toThrow("JPEG ou PNG uniquement");
    expect(sanitizeImage(jpeg())).toMatchObject({ type: "image/jpeg", width: 640, height: 480 });
  });
});
