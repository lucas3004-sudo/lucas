/**
 * Diffusion des annonces sur les portails (D-066). ImmoPilot ne publie pas lui-même : l'agence
 * publie avec ses propres abonnements (à la main avec le Pack annonce, ou plus tard par une
 * passerelle de multidiffusion). ImmoPilot suit où chaque bien est en ligne et rappelle de
 * retirer les annonces d'un bien vendu ou retiré.
 */

export const PORTALS = {
  seloger: "SeLoger",
  leboncoin: "Leboncoin",
  bienici: "Bien'ici",
  logicimmo: "Logic-Immo",
  site_agence: "Site de l'agence",
  autre: "Autre site",
} as const;
export type PortalId = keyof typeof PORTALS;
export const PORTAL_IDS = Object.keys(PORTALS) as PortalId[];

export interface PortalListing {
  portal: PortalId;
  status: "publie" | "retire";
}

/** Statuts du bien pour lesquels une annonce encore en ligne doit être retirée. */
export const CLOSED_STATUSES = ["vendu", "retire"] as const;

/** Portails où l'annonce est encore en ligne alors que le bien n'est plus à vendre. */
export function portalsToRemove(status: string, listings: readonly PortalListing[]): PortalId[] {
  if (!(CLOSED_STATUSES as readonly string[]).includes(status)) return [];
  return listings.filter((l) => l.status === "publie").map((l) => l.portal);
}

export const REMOVAL_TASK_PREFIX = "Retirer l'annonce";

/** Titre de la tâche de retrait (un seul rappel ouvert par bien, voir l'action de statut). */
export function removalTaskTitle(portals: readonly PortalId[], propertyLabel: string): string {
  return `${REMOVAL_TASK_PREFIX} de ${portals.map((p) => PORTALS[p]).join(", ")} : ${propertyLabel}`.slice(0, 200);
}

/** Lien d'annonce saisi par l'agent : https seulement, sans espace, 500 caractères au plus. */
export function cleanListingUrl(input: string): string | null | undefined {
  const url = input.trim();
  if (!url) return null;
  if (url.length > 500 || !/^https:\/\/[^\s]+$/.test(url)) return undefined;
  try {
    new URL(url);
    return url;
  } catch {
    return undefined;
  }
}

/** Le titre (premier paragraphe) et le corps du texte d'annonce, pour les champs séparés des portails. */
export function listingParts(text: string): { title: string; body: string } {
  const at = text.indexOf("\n\n");
  return at === -1 ? { title: text.trim(), body: "" } : { title: text.slice(0, at).trim(), body: text.slice(at + 2).trim() };
}
