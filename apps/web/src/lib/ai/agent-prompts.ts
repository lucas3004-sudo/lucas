/**
 * Consignes et données envoyées à l'IA par les agents (D-069). Seules les caractéristiques du
 * bien et du marché partent : ni rue, ni numéro, ni nom, ni coordonnées, ni notes libres.
 */
import { PROPERTY_FEATURES, type PropertyFeature } from "@immopilot/domain";
import type { Property } from "../crm/data";
import { splitLabel } from "../crm/listing";

const euros = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

/** Fiche du bien pour l'IA : ville et code postal seulement, pas l'adresse précise. */
export function propertyFacts(p: Property): string {
  const { postcode, city } = splitLabel(p.address_label);
  return [
    `Type : ${p.type}`,
    `Localisation : ${city}${postcode ? ` (${postcode})` : ""}`,
    p.surface ? `Surface habitable : ${p.surface} m²` : null,
    p.rooms ? `Pièces principales : ${p.rooms}` : null,
    p.price ? `Prix affiché : ${euros(p.price)}` : null,
    p.dpe_class ? `DPE : classe ${p.dpe_class}${p.ges_class ? `, GES ${p.ges_class}` : ""}` : null,
    p.features.length ? `Équipements : ${p.features.map((f) => PROPERTY_FEATURES[f as PropertyFeature]).join(", ")}` : null,
    p.is_copro ? `Copropriété${p.copro_lots ? ` de ${p.copro_lots} lots` : ""}` : null,
  ].filter(Boolean).join("\n");
}

const COMMON = `Tu travailles pour une agence immobilière française. Écris en français, simplement, sans jargon.
N'invente jamais une caractéristique, une pièce, une vue, un état ou un chiffre absents des données fournies.
Pas de formule discriminante ni de promesse invérifiable (« affaire unique », « coup de cœur assuré »…).`;

export const LISTING_SYSTEM = `${COMMON}
Tâche : rédaction d'annonce. À partir de la fiche du bien, rédige une annonce de vente.
- titre : 70 caractères au plus, factuel (type, pièces, surface, ville) ;
- description : 600 à 1 200 caractères, en paragraphes courts, sans le prix, les honoraires ni le DPE (ils sont ajoutés automatiquement avec les mentions obligatoires).
Réponds uniquement en JSON : {"titre": "...", "description": "..."}`;

export const ANALYSIS_SYSTEM = `${COMMON}
Tâche : analyse d'annonce. Pour l'agent responsable du bien, analyse l'annonce et le prix.
Donne, en 900 caractères au plus : 2 ou 3 points forts, 2 ou 3 points faibles ou manques de l'annonce, la position du prix par rapport au marché fourni (sans en inventer), et 2 ou 3 conseils concrets.
Choisis un verdict parmi : « prix bien placé », « prix élevé », « prix bas », « marché inconnu ».
Réponds uniquement en JSON : {"verdict": "...", "analyse": "..."}`;

export const FOLLOWUP_SYSTEM = `${COMMON}
Tâche : message de relance. Rédige un message court (700 caractères au plus) pour présenter ce bien à un acquéreur dont la recherche correspond.
Commence par « Bonjour [Prénom], », reste factuel, propose une visite, et ne signe pas (la signature est ajoutée ensuite).
Réponds uniquement par le texte du message.`;

export const RECAP_SYSTEM = `${COMMON}
Tâche : récap d'activité. En 3 ou 4 phrases, résume l'activité de l'agence à partir des chiffres fournis, puis dis ce qui demande une action en priorité. N'ajoute aucun chiffre qui ne soit pas fourni.
Réponds uniquement par le texte du récap.`;

export function marketFacts(estimate: { low: number; mid: number; high: number; comparables: number } | null, until: string | null): string {
  if (!estimate) return "Marché : pas assez de ventes comparables récentes autour pour situer le prix.";
  return `Marché (ventes réelles DVF${until ? ` jusqu'au ${until}` : ""}) : ${estimate.comparables} ventes comparables, estimation entre ${euros(estimate.low)} et ${euros(estimate.high)} (milieu ${euros(estimate.mid)}).`;
}

/** Premier objet JSON de la réponse, ou null (le modèle peut ajouter du texte autour). */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const v = JSON.parse(text.slice(start, end + 1));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const VERDICTS = ["prix bien placé", "prix élevé", "prix bas", "marché inconnu"] as const;

export function readListingDraft(text: string): { title: string; description: string } | null {
  const o = parseJsonObject(text);
  const title = typeof o?.titre === "string" ? o.titre.trim().slice(0, 120) : "";
  const description = typeof o?.description === "string" ? o.description.trim().slice(0, 4000) : "";
  return title && description.length >= 50 ? { title, description } : null;
}

export function readAnalysis(text: string): { verdict: string; analysis: string } | null {
  const o = parseJsonObject(text);
  const verdict = typeof o?.verdict === "string" ? o.verdict.trim().toLowerCase() : "";
  const analysis = typeof o?.analyse === "string" ? o.analyse.trim().slice(0, 1500) : "";
  if (!analysis) return null;
  return { verdict: (VERDICTS as readonly string[]).includes(verdict) ? verdict : "à relire", analysis };
}
