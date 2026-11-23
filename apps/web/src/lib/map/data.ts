/**
 * Données de la carte : biens de l'agence (visibles selon la RLS) avec leur position par rapport
 * au marché, et ventes réelles DVF de la zone affichée (sans adresse, conditions de réutilisation).
 */
import { withTenant } from "@immopilot/db";
import { lookbackStart, marketPosition, type MarketPosition } from "@immopilot/domain";
import type { AgencyContext } from "../agency/context";
import { listProperties, type Property } from "../crm/data";
import { getTenantPool } from "../server/db";

export interface MapProperty {
  id: string;
  label: string;
  lon: number;
  lat: number;
  type: Property["type"];
  status: Property["status"];
  price: number | null;
  surface: number | null;
  rooms: number | null;
  dpeClass: string | null;
  features: string[];
  /** Première photo du bien (null : aucune). */
  photoId: string | null;
  photoCount: number;
  mine: boolean;
  position: MarketPosition;
}

/** Médiane du prix au m² des ventes « ancien » sur 24 mois, par commune et type de bien. */
export async function communeMedians(inseeCodes: string[]): Promise<Map<string, { median: number; sales: number }>> {
  if (!inseeCodes.length) return new Map();
  const pool = getTenantPool();
  const until = (await pool.query<{ d: string | null }>("SELECT max(sale_date)::text AS d FROM ref.dvf_sales")).rows[0]?.d;
  if (!until) return new Map();
  const { rows } = await pool.query<{ insee_code: string; dwelling_type: string; median: number; sales: number }>(
    `SELECT insee_code, dwelling_type, percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_sqm)::float8 AS median, count(*)::int AS sales
     FROM ref.dvf_sales WHERE insee_code = ANY($1) AND nature = 'ancien' AND sale_date >= $2::date
     GROUP BY 1, 2`,
    [inseeCodes, lookbackStart(until)],
  );
  return new Map(rows.map((r) => [`${r.insee_code}|${r.dwelling_type}`, { median: r.median, sales: r.sales }]));
}

/** Première photo (ordre d'affichage) et nombre de photos de chaque bien visible (RLS). */
async function firstPhotos(ctx: AgencyContext, ids: string[]): Promise<Map<string, { id: string; count: number }>> {
  if (!ids.length) return new Map();
  return withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    new Map((await c.query<{ property_id: string; id: string; n: number }>(
      `SELECT DISTINCT ON (property_id) property_id, id, count(*) OVER (PARTITION BY property_id)::int AS n
       FROM app.property_photos WHERE property_id = ANY($1) ORDER BY property_id, position, created_at`,
      [ids],
    )).rows.map((r) => [r.property_id, { id: r.id, count: r.n }])));
}

export async function mapProperties(ctx: AgencyContext): Promise<MapProperty[]> {
  const properties = (await listProperties(ctx)).filter(
    (p): p is Property & { longitude: number; latitude: number } => typeof p.longitude === "number" && typeof p.latitude === "number",
  );
  const [medians, photos] = await Promise.all([
    communeMedians([...new Set(properties.map((p) => p.insee_code))]),
    firstPhotos(ctx, properties.map((p) => p.id)),
  ]);
  return properties.map((p) => ({
    id: p.id, label: p.address_label, lon: p.longitude, lat: p.latitude, type: p.type, status: p.status,
    price: p.price, surface: p.surface, rooms: p.rooms, dpeClass: p.dpe_class, features: p.features,
    photoId: photos.get(p.id)?.id ?? null, photoCount: photos.get(p.id)?.count ?? 0, mine: p.owner_user_id === ctx.user.id,
    position: marketPosition({ price: p.price, surface: p.surface }, medians.get(`${p.insee_code}|${p.type}`) ?? null),
  }));
}

export interface MapSale {
  date: string;
  type: string;
  price: number;
  surface: number;
  pricePerSqm: number;
  lon: number;
  lat: number;
}

export const MAX_MAP_SALES = 1500;

/** Ventes « ancien » des 24 derniers mois disponibles dans un rectangle (au plus 1 500, les plus récentes). */
export async function salesInBox(box: { west: number; south: number; east: number; north: number }): Promise<MapSale[]> {
  const pool = getTenantPool();
  const until = (await pool.query<{ d: string | null }>("SELECT max(sale_date)::text AS d FROM ref.dvf_sales")).rows[0]?.d;
  if (!until) return [];
  const { rows } = await pool.query<MapSale>(
    `SELECT sale_date::text AS date, dwelling_type AS type, price::float8 AS price, surface::float8 AS surface,
            price_per_sqm::float8 AS "pricePerSqm", extensions.ST_X(geom) AS lon, extensions.ST_Y(geom) AS lat
     FROM ref.dvf_sales
     WHERE geom IS NOT NULL AND nature = 'ancien' AND sale_date >= $5::date
       -- Forme fonction (l'opérateur && est dans le schéma extensions) ; profite de l'index géographique.
       AND extensions.ST_Intersects(geom::extensions.geography, extensions.ST_MakeEnvelope($1, $2, $3, $4, 4326)::extensions.geography)
     ORDER BY sale_date DESC LIMIT ${MAX_MAP_SALES}`,
    [box.west, box.south, box.east, box.north, lookbackStart(until)],
  );
  return rows;
}
