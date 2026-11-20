/**
 * Détection des doublons de contacts (Duplicate Contact Detection Agent, mode déterministe).
 * Signale, ne fusionne jamais seul : la fusion est une action L2 (validation humaine).
 */

export function normalizeEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return e.includes("@") ? e : null;
}

/** Numéro français ramené à 10 chiffres (« +33 6 12… » → « 0612… »). */
export function normalizePhone(phone: string | null | undefined): string | null {
  let digits = (phone ?? "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+33")) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith("0033")) digits = `0${digits.slice(4)}`;
  digits = digits.replace(/\D/g, "");
  return digits.length >= 9 ? digits : null;
}

export function normalizeName(first: string | null | undefined, last: string | null | undefined): string {
  return `${first ?? ""} ${last ?? ""}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
}

export interface ContactLike {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

export type DuplicateReason = "email" | "telephone" | "nom";

export interface Duplicate {
  id: string;
  reasons: DuplicateReason[];
}

export function findDuplicates(candidate: Omit<ContactLike, "id">, existing: readonly ContactLike[]): Duplicate[] {
  const email = normalizeEmail(candidate.email);
  const phone = normalizePhone(candidate.phone);
  const name = normalizeName(candidate.firstName, candidate.lastName);
  const result: Duplicate[] = [];
  for (const other of existing) {
    const reasons: DuplicateReason[] = [];
    if (email && normalizeEmail(other.email) === email) reasons.push("email");
    if (phone && normalizePhone(other.phone) === phone) reasons.push("telephone");
    if (name.includes(" ") && normalizeName(other.firstName, other.lastName) === name) reasons.push("nom");
    if (reasons.length) result.push({ id: other.id, reasons });
  }
  return result;
}
