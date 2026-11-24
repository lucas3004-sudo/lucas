/**
 * Page publique « Estimez votre bien » (D-067). Le visiteur n'a pas de compte : on passe par deux
 * fonctions de la base (app.public_estimation_page, app.capture_public_lead) qui vérifient que la
 * page est ouverte et limitent les envois. Aucune lecture des données de l'agence n'est possible.
 */
import { createHash } from "node:crypto";
import { geocode, type Address } from "@immopilot/integrations";
import { marketEstimate } from "../dossier/compute";
import { getTenantPool } from "../server/db";

export interface PublicPage {
  orgId: string;
  name: string;
}

export async function publicEstimationPage(slug: string): Promise<PublicPage | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const row = (await getTenantPool().query<{ org_id: string; name: string }>("SELECT * FROM app.public_estimation_page($1)", [slug])).rows[0];
  return row ? { orgId: row.org_id, name: row.name } : null;
}

/** Empreinte de l'adresse IP (jamais l'adresse elle-même), salée par le secret du serveur. */
export function ipHash(forwardedFor: string | null, realIp: string | null): string {
  const ip = (forwardedFor?.split(",")[0] ?? realIp ?? "inconnue").trim();
  return createHash("sha256").update(`${process.env.BETTER_AUTH_SECRET ?? ""}|${ip}`).digest("hex");
}

/** Adresse précise (numéro de rue) trouvée par la Base Adresse Nationale, ou null. */
export async function findAddress(query: string): Promise<Address | null> {
  const results = await geocode(query, { limit: 1 });
  const best = results[0];
  return best && best.type === "housenumber" && best.score >= 0.5 ? best : null;
}

export interface PublicEstimate {
  low: number;
  high: number;
  comparables: number;
  radiusKm: number;
  until: string | null;
}

/** Fourchette indicative à partir des ventes réelles autour, ou null si elles sont trop peu nombreuses. */
export async function publicEstimate(address: Address, type: "Appartement" | "Maison", surface: number, rooms: number | null): Promise<PublicEstimate | null> {
  const { estimate, market } = await marketEstimate(getTenantPool(), address, { type, surface, rooms });
  if (estimate.status !== "ok") return null;
  // Arrondi au millier d'euros : une estimation en ligne reste un ordre de grandeur.
  const round = (n: number) => Math.round(n / 1000) * 1000;
  return {
    low: round(estimate.low), high: round(estimate.high), comparables: estimate.comparables,
    radiusKm: (market.value?.radiusM ?? 0) / 1000, until: market.value?.to ?? null,
  };
}
