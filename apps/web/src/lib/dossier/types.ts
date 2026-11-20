/**
 * Dossier de bien : instantané immuable enregistré dans app.analyses.snapshot.
 * Chaque bloc porte sa PROVENANCE (docs/phase-2/modele-donnees.md, section 2) :
 * statut, source, date, et une note quand la donnée manque.
 */
import type { Comparable, DwellingType, Estimate, Summary } from "@immopilot/domain";
import type { DpeRecord, RiskReport } from "@immopilot/integrations";

export type DataStatus = "verifiee" | "declaree" | "estimee" | "hypothese" | "manquante";

export interface SourceRef {
  id: "ban" | "dvf" | "dpe" | "georisques" | "loyers" | "zonage";
  label: string;
  /** Date de la donnée (fin de période DVF, millésime, date d'obtention…). */
  asOf: string | null;
  citation: string;
  url?: string;
}

export interface Sourced<T> {
  status: DataStatus;
  value: T | null;
  source: SourceRef;
  note?: string;
}

export interface DossierInputs {
  type: DwellingType;
  surface: number;
  rooms: number | null;
}

export interface MarketData {
  radiusM: number;
  from: string;
  to: string;
  stats: Summary | null;
  /** Les plus proches d'abord, au plus 30. Sans adresse : uniquement des caractéristiques (D-007). */
  comparables: Comparable[];
}

export interface RentData {
  segment: string;
  millesime: number;
  perSqm: number;
  low: number;
  high: number;
  monthlyLow: number;
  monthlyHigh: number;
  prediction: string;
  observations: number | null;
  r2Adj: number | null;
  reliable: boolean;
}

export interface DossierSnapshot {
  version: 1;
  computedAt: string;
  address: Sourced<{
    label: string;
    banId: string;
    inseeCode: string;
    department: string;
    city: string;
    postcode: string;
    longitude: number;
    latitude: number;
  }>;
  inputs: Sourced<DossierInputs>;
  market: Sourced<MarketData>;
  estimate: Sourced<Estimate>;
  dpe: Sourced<DpeRecord[]>;
  risks: Sourced<RiskReport>;
  rent: Sourced<RentData>;
  zonage: Sourced<{ zone: string; inForceFrom: string | null }>;
}
