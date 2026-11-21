/**
 * Lecture CSV (RFC 4180) : séparateur paramétrable, champs entre guillemets, guillemets
 * doublés, fins de ligne Windows ou Unix. Fonction pure, utilisée pour DVF (virgule),
 * les loyers ANIL et le zonage ABC (point-virgule).
 */
export function parseCsv(text: string, separator = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === separator) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** Transforme un CSV avec en-tête en objets (clés = noms de colonnes). */
export function csvRecords<T extends Record<string, string>>(text: string, separator = ","): T[] {
  const [header, ...rows] = parseCsv(text, separator);
  if (!header) return [];
  return rows.map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""])) as T);
}

export type CsvCell = string | number | null | undefined;

/**
 * Écriture CSV pour Excel (France) : point-virgule, guillemets si nécessaire, fins de ligne CRLF.
 * Protection contre l'injection de formules : une cellule de TEXTE qui commence par = + - @,
 * une tabulation ou un retour chariot est préfixée d'une apostrophe (recommandation OWASP).
 * Les nombres restent des nombres (virgule décimale française).
 */
export function toCsv(rows: readonly (readonly CsvCell[])[], separator = ";"): string {
  const cell = (v: CsvCell): string => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return Number.isFinite(v) ? String(v).replace(".", ",") : "";
    let s = v;
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /["\n\r]/.test(s) || s.includes(separator) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(separator)).join("\r\n") + "\r\n";
}
