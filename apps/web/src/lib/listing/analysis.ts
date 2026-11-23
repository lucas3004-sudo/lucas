/**
 * Analyse chiffrée d'une annonce (fiche du bien) : réutilise le calcul du dossier de bien
 * (ventes comparables DVF, loyers ANIL, risques, zonage) et en tire un verdict sans IA.
 */
import { listingVerdict, marketPosition, type MarketPosition, type VerdictResult } from "@immopilot/domain";
import type { Property } from "../crm/data";
import { computeDossier } from "../dossier/compute";
import type { DossierSnapshot } from "../dossier/types";
import { communeMedians } from "../map/data";
import { getTenantPool } from "../server/db";

export interface ListingAnalysis {
  verdict: VerdictResult;
  position: MarketPosition;
  snapshot: DossierSnapshot | null;
  city: string | null;
}

function department(insee: string): string {
  if (insee.startsWith("97")) return insee.slice(0, 3);
  return insee.slice(0, 2);
}

export async function listingAnalysis(p: Property): Promise<ListingAnalysis> {
  const m = /(\d{5})\s+(.+)$/.exec(p.address_label);
  const city = m?.[2] ?? null;
  const medians = await communeMedians([p.insee_code]);
  const position = marketPosition({ price: p.price, surface: p.surface }, medians.get(`${p.insee_code}|${p.type}`) ?? null);
  if (!p.surface || p.longitude === null || p.latitude === null) {
    return { verdict: listingVerdict({ price: p.price, surface: p.surface, estimate: null, position, rent: null, city }), position, snapshot: null, city };
  }
  const snapshot = await computeDossier(
    getTenantPool(),
    {
      label: p.address_label, banId: p.ban_id, inseeCode: p.insee_code, postcode: m?.[1] ?? "", city: city ?? "",
      department: department(p.insee_code), longitude: p.longitude, latitude: p.latitude, score: 1, type: "housenumber",
    },
    { type: p.type, surface: p.surface, rooms: p.rooms },
  );
  const est = snapshot.estimate.value;
  const rent = snapshot.rent.value;
  const verdict = listingVerdict({
    price: p.price, surface: p.surface, position, city,
    estimate: est && est.status === "ok" ? { low: est.low, mid: est.mid, high: est.high, comparables: est.comparables } : null,
    rent: rent ? { monthlyLow: rent.monthlyLow, monthlyHigh: rent.monthlyHigh, millesime: rent.millesime } : null,
  });
  return { verdict, position, snapshot, city };
}
