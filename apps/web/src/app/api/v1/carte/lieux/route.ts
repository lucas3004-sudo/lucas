/**
 * Recherche d'un lieu pour la carte (commune, rue ou adresse), via la Base Adresse Nationale.
 * Renvoie libellé, type et coordonnées. Réservé aux utilisateurs connectés.
 */
import { geocode } from "@immopilot/integrations";
import { getSession } from "@/lib/agency/context";

const TYPES = new Set(["municipality", "street", "housenumber", "locality"]);

export async function GET(request: Request) {
  if (!(await getSession())) return Response.json({ results: [] }, { status: 401 });
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) return Response.json({ results: [] });
  try {
    const results = (await geocode(q, { limit: 8 }))
      .filter((a) => TYPES.has(a.type) && Number.isFinite(a.longitude) && Number.isFinite(a.latitude))
      .slice(0, 6)
      .map((a) => ({ label: a.label, type: a.type, lon: a.longitude, lat: a.latitude }));
    return Response.json({ results }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ results: [], error: "Service d'adresses indisponible." }, { status: 503 });
  }
}
