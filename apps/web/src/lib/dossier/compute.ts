/**
 * Calcul d'un dossier de bien à partir d'une adresse géocodée et des caractéristiques déclarées.
 * Aucune valeur n'est inventée : une source indisponible donne un bloc « manquante » avec la raison.
 * Les chiffres viennent des données publiques et des fonctions testées de @immopilot/domain.
 */
import {
  estimateRange, lookbackStart, MIN_COMPARABLES, RADIUS_STEPS_M, SURFACE_RATIO, summarize, TARGET_COMPARABLES,
  type Comparable,
} from "@immopilot/domain";
import {
  BAN_CITATION, DPE_CITATION, dpeByBanId, DVF_CITATION, DVF_UNCOVERED_DEPARTMENTS, fetchRiskReport, GEORISQUES_CITATION,
  RENTS_CITATION, toRiskReport, type Address, type DpeRecord, type RawReport,
} from "@immopilot/integrations";
import type pg from "pg";
import type { DossierInputs, DossierSnapshot, MarketData, RentData, SourceRef, Sourced } from "./types";

const DPE_TTL_DAYS = 7;
const RISKS_TTL_DAYS = 30;
const today = () => new Date().toISOString().slice(0, 10);

const missing = <T>(source: SourceRef, note: string): Sourced<T> => ({ status: "manquante", value: null, source, note });

async function cached<T>(pool: pg.Pool, table: "dpe_cache" | "risks_cache", keyColumn: string, key: string, ttlDays: number, load: () => Promise<T>): Promise<{ value: T; fetchedAt: string }> {
  const { rows } = await pool.query<{ payload: T; fetched_at: Date }>(
    `SELECT payload, fetched_at FROM ref.${table} WHERE ${keyColumn} = $1 AND fetched_at > now() - make_interval(days => $2)`,
    [key, ttlDays],
  );
  if (rows[0]) return { value: rows[0].payload, fetchedAt: rows[0].fetched_at.toISOString().slice(0, 10) };
  const value = await load();
  await pool.query(
    `INSERT INTO ref.${table} (${keyColumn}, payload, fetched_at) VALUES ($1, $2, now())
     ON CONFLICT (${keyColumn}) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now()`,
    [key, JSON.stringify(value)],
  );
  return { value, fetchedAt: today() };
}

async function market(pool: pg.Pool, address: Address, inputs: DossierInputs): Promise<{ market: Sourced<MarketData>; comparables: Comparable[] }> {
  const source: SourceRef = { id: "dvf", label: "DVF (ventes réelles)", asOf: null, citation: DVF_CITATION };
  if (DVF_UNCOVERED_DEPARTMENTS.has(address.department)) {
    return { market: missing(source, "DVF non disponible dans ce département (régime du Livre foncier ou Mayotte)."), comparables: [] };
  }
  const run = await pool.query<{ data_until: string }>(
    `SELECT data_until::text FROM ref.source_runs WHERE source = 'dvf' AND scope = $1 AND status = 'reussie'
     ORDER BY finished_at DESC LIMIT 1`,
    [address.department],
  );
  const until = run.rows[0]?.data_until;
  if (!until) {
    return { market: missing(source, `Les ventes DVF du département ${address.department} ne sont pas encore chargées dans cet environnement.`), comparables: [] };
  }
  source.asOf = until;
  const from = lookbackStart(until);
  let comparables: Comparable[] = [];
  let radiusM: number = RADIUS_STEPS_M[0];
  for (const radius of RADIUS_STEPS_M) {
    radiusM = radius;
    const { rows } = await pool.query<{ mutation_id: string; sale_date: string; price: number; surface: number; price_per_sqm: number; distance: number }>(
      `WITH p AS (SELECT extensions.ST_SetSRID(extensions.ST_MakePoint($1, $2), 4326)::extensions.geography AS g)
       SELECT mutation_id, sale_date::text, price::float8 AS price, surface::float8 AS surface,
              price_per_sqm::float8 AS price_per_sqm, extensions.ST_Distance(s.geom::extensions.geography, p.g) AS distance
       FROM ref.dvf_sales s, p
       WHERE s.dwelling_type = $3 AND s.nature = 'ancien' AND s.sale_date >= $4::date
         AND s.surface BETWEEN $5 AND $6
         AND extensions.ST_DWithin(s.geom::extensions.geography, p.g, $7)
       ORDER BY distance`,
      [address.longitude, address.latitude, inputs.type, from, inputs.surface * SURFACE_RATIO.min, inputs.surface * SURFACE_RATIO.max, radius],
    );
    comparables = rows.map((r) => ({
      mutationId: r.mutation_id, date: r.sale_date, price: r.price, surface: r.surface, pricePerSqm: r.price_per_sqm, distanceM: Math.round(r.distance),
    }));
    if (comparables.length >= TARGET_COMPARABLES) break;
  }
  const value: MarketData = {
    radiusM, from, to: until,
    stats: comparables.length ? summarize(comparables.map((c) => c.pricePerSqm)) : null,
    comparables: comparables.slice(0, 30),
  };
  return {
    market: {
      status: comparables.length ? "verifiee" : "manquante",
      value,
      source,
      note: comparables.length ? undefined : `Aucune vente comparable dans un rayon de ${radiusM / 1000} km sur 24 mois.`,
    },
    comparables,
  };
}

function rentSegment(inputs: DossierInputs): string {
  if (inputs.type === "Maison") return "maison";
  if (inputs.rooms === null) return "appartement";
  return inputs.rooms <= 2 ? "appartement_t1_t2" : "appartement_t3_plus";
}

async function rent(pool: pg.Pool, address: Address, inputs: DossierInputs): Promise<Sourced<RentData>> {
  const segment = rentSegment(inputs);
  const source: SourceRef = { id: "loyers", label: "Carte des loyers (ANIL)", asOf: null, citation: RENTS_CITATION };
  const { rows } = await pool.query<{ millesime: number; rent_per_sqm: string; low: string; high: string; prediction: string; obs_commune: number | null; r2_adj: string | null }>(
    `SELECT millesime, rent_per_sqm, low, high, prediction, obs_commune, r2_adj FROM ref.rents
     WHERE insee_code = $1 AND segment = $2 ORDER BY millesime DESC LIMIT 1`,
    [address.inseeCode, segment],
  );
  const r = rows[0];
  if (!r) return missing(source, "Aucun indicateur de loyer pour cette commune (ou données non chargées).");
  source.asOf = String(r.millesime);
  const perSqm = Number(r.rent_per_sqm), low = Number(r.low), high = Number(r.high);
  const r2 = r.r2_adj === null ? null : Number(r.r2_adj);
  return {
    status: "estimee",
    source,
    value: {
      segment, millesime: r.millesime, perSqm, low, high,
      monthlyLow: Math.round(low * inputs.surface), monthlyHigh: Math.round(high * inputs.surface),
      prediction: r.prediction, observations: r.obs_commune, r2Adj: r2,
      reliable: r2 !== null && r2 >= 0.5,
    },
    note: "Loyer d'annonce, charges comprises, logement non meublé (3e trimestre de l'année de référence). Le loyer signé est souvent inférieur.",
  };
}

async function zonage(pool: pg.Pool, address: Address): Promise<DossierSnapshot["zonage"]> {
  const source: SourceRef = { id: "zonage", label: "Zonage ABC", asOf: null, citation: "Ministère chargé du logement, Licence Ouverte" };
  const { rows } = await pool.query<{ zone: string; in_force_from: string | null }>(
    "SELECT zone, in_force_from::text FROM ref.zonage_abc WHERE insee_code = $1", [address.inseeCode],
  );
  const r = rows[0];
  if (!r) return missing(source, "Zonage non trouvé (ou données non chargées).");
  source.asOf = r.in_force_from;
  return { status: "verifiee", source, value: { zone: r.zone, inForceFrom: r.in_force_from } };
}

/**
 * Estimation seule, à partir des ventes DVF autour (sans DPE ni Géorisques) : rapide, sans appel
 * externe, pour la page publique « Estimez votre bien » (D-067).
 */
export async function marketEstimate(pool: pg.Pool, address: Address, inputs: DossierInputs) {
  const { market: block, comparables } = await market(pool, address, inputs);
  return { estimate: estimateRange(inputs.surface, comparables), market: block };
}

export async function computeDossier(pool: pg.Pool, address: Address, inputs: DossierInputs): Promise<DossierSnapshot> {
  const banSource: SourceRef = { id: "ban", label: "Base Adresse Nationale", asOf: today(), citation: BAN_CITATION };
  const dpeSource: SourceRef = { id: "dpe", label: "DPE (ADEME)", asOf: null, citation: DPE_CITATION };
  const riskSource: SourceRef = { id: "georisques", label: "Géorisques", asOf: null, citation: GEORISQUES_CITATION };

  const [marketResult, dpeResult, riskResult, rentResult, zonageResult] = await Promise.allSettled([
    market(pool, address, inputs),
    cached<DpeRecord[]>(pool, "dpe_cache", "ban_id", address.banId, DPE_TTL_DAYS, () => dpeByBanId(address.banId)),
    cached<RawReport>(pool, "risks_cache", "cache_key", address.banId, RISKS_TTL_DAYS, () => fetchRiskReport(address.longitude, address.latitude)),
    rent(pool, address, inputs),
    zonage(pool, address),
  ]);

  const unavailable = (label: string, reason: unknown) =>
    `Source ${label} momentanément indisponible (${(reason as Error)?.message ?? "erreur"}). Relancez le dossier plus tard.`;

  const marketBlock = marketResult.status === "fulfilled" ? marketResult.value.market : missing<MarketData>({ id: "dvf", label: "DVF (ventes réelles)", asOf: null, citation: DVF_CITATION }, unavailable("DVF", marketResult.reason));
  const comparables = marketResult.status === "fulfilled" ? marketResult.value.comparables : [];
  const estimate = estimateRange(inputs.surface, comparables);

  let dpe: Sourced<DpeRecord[]>;
  if (dpeResult.status === "fulfilled") {
    dpeSource.asOf = dpeResult.value.fetchedAt;
    dpe = dpeResult.value.value.length
      ? { status: "verifiee", source: dpeSource, value: dpeResult.value.value }
      : missing(dpeSource, "Aucun DPE enregistré à cette adresse dans la base de l'ADEME.");
  } else dpe = missing(dpeSource, unavailable("DPE", dpeResult.reason));

  let risks: Sourced<ReturnType<typeof toRiskReport>>;
  if (riskResult.status === "fulfilled") {
    riskSource.asOf = riskResult.value.fetchedAt;
    const report = toRiskReport(riskResult.value.value);
    riskSource.url = report.officialReportUrl ?? undefined;
    risks = { status: "verifiee", source: riskSource, value: report };
  } else risks = missing(riskSource, unavailable("Géorisques", riskResult.reason));

  return {
    version: 1,
    computedAt: new Date().toISOString(),
    address: {
      status: "verifiee",
      source: banSource,
      value: {
        label: address.label, banId: address.banId, inseeCode: address.inseeCode, department: address.department,
        city: address.city, postcode: address.postcode, longitude: address.longitude, latitude: address.latitude,
      },
    },
    inputs: { status: "declaree", source: { id: "ban", label: "Saisie de l'utilisateur", asOf: today(), citation: "Caractéristiques déclarées" }, value: inputs },
    market: marketBlock,
    estimate:
      estimate.status === "ok"
        ? { status: "estimee", source: marketBlock.source, value: estimate }
        : {
            status: "manquante",
            source: marketBlock.source,
            value: estimate,
            // Si les ventes elles-mêmes manquent, on donne cette raison-là (et non « trop peu de ventes »).
            note: marketBlock.status === "manquante" && marketBlock.note ? marketBlock.note : `Moins de ${MIN_COMPARABLES} ventes comparables : pas d'estimation.`,
          },
    dpe,
    risks,
    rent: rentResult.status === "fulfilled" ? rentResult.value : missing({ id: "loyers", label: "Carte des loyers (ANIL)", asOf: null, citation: RENTS_CITATION }, unavailable("loyers", rentResult.reason)),
    zonage: zonageResult.status === "fulfilled" ? zonageResult.value : missing({ id: "zonage", label: "Zonage ABC", asOf: null, citation: "" }, unavailable("zonage", zonageResult.reason)),
  };
}
