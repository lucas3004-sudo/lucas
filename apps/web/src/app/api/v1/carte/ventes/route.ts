/** Ventes réelles (DVF) de la zone affichée sur la carte. Réservé aux membres connectés. */
import { requireAgency } from "@/lib/agency/context";
import { MAX_MAP_SALES, salesInBox } from "@/lib/map/data";

/** Au-delà (≈ 30 km de côté), on demande de zoomer : la carte resterait illisible. */
const MAX_SPAN_DEG = 0.4;

export async function GET(request: Request) {
  await requireAgency();
  const parts = (new URL(request.url).searchParams.get("bbox") ?? "").split(",").map(Number);
  const [west, south, east, north] = parts as [number, number, number, number];
  const valid = parts.length === 4 && parts.every(Number.isFinite) && west < east && south < north
    && west >= -180 && east <= 180 && south >= -90 && north <= 90;
  if (!valid) return Response.json({ error: "Zone invalide." }, { status: 400 });
  if (east - west > MAX_SPAN_DEG || north - south > MAX_SPAN_DEG) {
    return Response.json({ sales: [], tooWide: true }, { headers: { "cache-control": "no-store" } });
  }
  const sales = await salesInBox({ west, south, east, north });
  return Response.json({ sales, truncated: sales.length >= MAX_MAP_SALES }, { headers: { "cache-control": "no-store" } });
}
