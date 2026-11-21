/**
 * Fiche annonce : texte produit À PARTIR DES DONNÉES SAISIES (aucune IA, aucune reformulation
 * des caractéristiques) et contrôle des mentions obligatoires (fiche juridique 1.1).
 * Les bases légales marquées « à confirmer » dans la fiche juridique doivent être validées
 * par l'avocat : le contrôle est une AIDE, pas une garantie de conformité.
 */

export type EnergyClass = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export interface ListingInput {
  type: "Appartement" | "Maison";
  city: string;
  postcode: string;
  surface: number | null;
  rooms: number | null;
  /** Prix affiché, honoraires inclus le cas échéant (€). */
  price: number | null;
  dpeClass: EnergyClass | null;
  gesClass: EnergyClass | null;
  energyCostLow: number | null;
  energyCostHigh: number | null;
  energyCostYear: number | null;
  /** null : non renseigné (le contrôle le signale). */
  isCopro: boolean | null;
  coproLots: number | null;
  coproAnnualCharges: number | null;
  coproProcedure: string | null;
  feesPayer: "vendeur" | "acquereur" | null;
  /** Honoraires TTC en % du prix hors honoraires (si à la charge de l'acquéreur). */
  feesPercent: number | null;
  feeScheduleUrl: string | null;
  title: string | null;
  description: string | null;
}

export type CheckStatus = "ok" | "manquante";

export interface MentionCheck {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export const GEORISQUES_MENTION =
  "Les informations sur les risques auxquels ce bien est exposé sont disponibles sur le site Géorisques : www.georisques.gouv.fr";
export const EXCESSIVE_CONSUMPTION_MENTION = "Logement à consommation énergétique excessive : classe F ou G.";

// Espaces ordinaires : le texte est copié dans des portails qui gèrent mal les espaces insécables fines.
const plainSpaces = (s: string) => s.replace(/[\u202f\u00a0]/g, " ");
const euros = (v: number) => `${plainSpaces(Math.round(v).toLocaleString("fr-FR"))} €`;
const percent = (v: number) => `${plainSpaces(v.toLocaleString("fr-FR", { maximumFractionDigits: 2 }))} %`;

/** Prix hors honoraires quand les honoraires sont à la charge de l'acquéreur : prix FAI / (1 + taux). */
export function priceExcludingFees(priceWithFees: number, feesPercent: number): number {
  return Math.round(priceWithFees / (1 + feesPercent / 100));
}

export function checkListing(i: ListingInput): MentionCheck[] {
  const checks: MentionCheck[] = [];
  const add = (key: string, label: string, ok: boolean, detail: string) => checks.push({ key, label, status: ok ? "ok" : "manquante", detail });

  add("prix", "Prix de vente", i.price !== null && i.price > 0, i.price ? euros(i.price) : "Le prix affiché doit être renseigné.");
  add(
    "dpe",
    "Classes énergie et climat du DPE",
    i.dpeClass !== null && i.gesClass !== null,
    i.dpeClass && i.gesClass ? `Énergie ${i.dpeClass}, climat ${i.gesClass}.` : "Les deux classes (énergie et climat) sont exigées.",
  );
  const costsOk = i.energyCostLow !== null && i.energyCostHigh !== null && i.energyCostYear !== null && i.energyCostLow <= i.energyCostHigh;
  add(
    "depenses_energie",
    "Estimation des dépenses annuelles d'énergie",
    costsOk,
    costsOk ? `Entre ${euros(i.energyCostLow!)} et ${euros(i.energyCostHigh!)} par an (prix de référence ${i.energyCostYear}).` : "Fourchette basse, haute et année de référence des prix, reprises du DPE.",
  );
  if (i.isCopro === null) {
    add("copropriete", "Copropriété", false, "Indiquez si le bien est soumis au régime de la copropriété.");
  } else if (i.isCopro) {
    const ok = i.coproLots !== null && i.coproAnnualCharges !== null;
    add(
      "copropriete",
      "Copropriété : nombre de lots et charges annuelles",
      ok,
      ok ? `${i.coproLots} lots, ${euros(i.coproAnnualCharges!)} de charges par an en moyenne.` : "Nombre de lots et montant moyen annuel des charges exigés.",
    );
  } else {
    add("copropriete", "Copropriété", true, "Bien hors copropriété.");
  }
  if (i.feesPayer === null) {
    add("honoraires", "Honoraires", false, "Indiquez à la charge de qui sont les honoraires.");
  } else if (i.feesPayer === "acquereur") {
    const ok = i.feesPercent !== null && i.feesPercent > 0;
    add("honoraires", "Honoraires à la charge de l'acquéreur", ok, ok ? `${percent(i.feesPercent!)} TTC du prix hors honoraires.` : "Pourcentage TTC exigé.");
  } else {
    add("honoraires", "Honoraires", true, "À la charge du vendeur.");
  }
  add(
    "bareme",
    "Lien vers le barème des honoraires",
    Boolean(i.feeScheduleUrl),
    i.feeScheduleUrl ? i.feeScheduleUrl : "À renseigner dans les paramètres de l'agence.",
  );
  add("georisques", "Renvoi vers Géorisques", true, "Ajouté automatiquement.");
  if (i.dpeClass === "F" || i.dpeClass === "G") add("passoire", "Mention « consommation énergétique excessive »", true, "Ajoutée automatiquement (classe F ou G).");
  return checks;
}

export function isPublishable(checks: readonly MentionCheck[]): boolean {
  return checks.every((c) => c.status === "ok");
}

/** Texte de l'annonce : titre, description de l'agent, caractéristiques et mentions légales. */
export function buildListingText(i: ListingInput): string {
  const parts: string[] = [];
  const headline =
    i.title?.trim() ||
    [`${i.type} ${i.rooms ? `${i.rooms} pièce${i.rooms > 1 ? "s" : ""}` : ""}`.trim(), i.surface ? `${i.surface.toLocaleString("fr-FR")} m²` : null, i.city]
      .filter(Boolean)
      .join(" – ");
  parts.push(headline);
  if (i.description?.trim()) parts.push(i.description.trim());

  const facts = [
    `${i.type} situé(e) à ${i.city} (${i.postcode})`,
    i.surface ? `surface habitable ${i.surface.toLocaleString("fr-FR")} m²` : null,
    i.rooms ? `${i.rooms} pièce(s) principale(s)` : null,
  ].filter(Boolean);
  parts.push(`${facts.join(", ")}.`);

  if (i.price) {
    if (i.feesPayer === "acquereur" && i.feesPercent) {
      parts.push(
        `Prix : ${euros(i.price)} honoraires inclus, dont ${percent(i.feesPercent)} TTC d'honoraires à la charge de l'acquéreur (${euros(priceExcludingFees(i.price, i.feesPercent))} hors honoraires).`,
      );
    } else if (i.feesPayer === "vendeur") {
      parts.push(`Prix : ${euros(i.price)}. Honoraires à la charge du vendeur.`);
    } else {
      parts.push(`Prix : ${euros(i.price)}.`);
    }
  }
  if (i.feeScheduleUrl) parts.push(`Barème des honoraires : ${i.feeScheduleUrl}`);

  if (i.dpeClass && i.gesClass) parts.push(`Diagnostic de performance énergétique : classe énergie ${i.dpeClass}, classe climat ${i.gesClass}.`);
  if (i.energyCostLow !== null && i.energyCostHigh !== null && i.energyCostYear !== null) {
    parts.push(
      `Montant estimé des dépenses annuelles d'énergie pour un usage standard : entre ${euros(i.energyCostLow)} et ${euros(i.energyCostHigh)} par an. Prix moyens des énergies indexés sur l'année ${i.energyCostYear} (abonnements compris).`,
    );
  }
  if (i.dpeClass === "F" || i.dpeClass === "G") parts.push(EXCESSIVE_CONSUMPTION_MENTION);

  if (i.isCopro) {
    const copro = [`Bien soumis au régime de la copropriété.`];
    if (i.coproLots !== null) copro.push(`Nombre de lots : ${i.coproLots}.`);
    if (i.coproAnnualCharges !== null) copro.push(`Montant moyen annuel des charges : ${euros(i.coproAnnualCharges)}.`);
    if (i.coproProcedure?.trim()) copro.push(`Procédure en cours : ${i.coproProcedure.trim()}`);
    parts.push(copro.join(" "));
  }
  parts.push(GEORISQUES_MENTION);
  return parts.join("\n\n");
}
