/**
 * Historique d'un bien (D-061), calculé à partir des événements notés par la base :
 * date de mise en vente, durée en vente, évolution du prix.
 */

export type PropertyEventKind = "cree" | "prix" | "statut" | "mandat";

export interface PropertyEvent {
  kind: PropertyEventKind;
  oldValue: string | null;
  newValue: string | null;
  at: Date;
}

export interface PriceChange {
  at: Date;
  from: number;
  to: number;
  /** Variation relative, arrondie à 4 décimales (−0,0440 = −4,4 %). */
  change: number;
}

export interface ListingHistory {
  /** Date de mise en vente : passage au statut « mandat », ou création d'un bien déjà en vente. */
  listedOn: Date | null;
  /** Jours en vente, jusqu'à aujourd'hui ou jusqu'à la vente ou au retrait. */
  daysOnMarket: number | null;
  priceChanges: PriceChange[];
  firstPrice: number | null;
  /** Variation entre le premier prix connu et le prix actuel. */
  totalChange: number | null;
}

const DAY = 86_400_000;
const ON_MARKET = new Set(["mandat", "sous_offre"]);
const OFF_MARKET = new Set(["vendu", "retire"]);

const num = (v: string | null) => (v === null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

export function listingHistory(events: readonly PropertyEvent[], currentStatus: string, currentPrice: number | null, now = new Date()): ListingHistory {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const created = sorted.find((e) => e.kind === "cree") ?? null;
  const statusEvents = sorted.filter((e) => e.kind === "statut");

  // Mise en vente : premier passage vers « mandat » ; à défaut, la création si le bien a été saisi déjà en vente.
  let listedOn: Date | null = statusEvents.find((e) => e.newValue === "mandat")?.at ?? null;
  if (!listedOn && created) {
    const statusAtCreation = statusEvents[0]?.oldValue ?? currentStatus;
    if (ON_MARKET.has(statusAtCreation) || OFF_MARKET.has(statusAtCreation)) listedOn = created.at;
  }

  let daysOnMarket: number | null = null;
  if (listedOn) {
    const ended = statusEvents.find((e) => e.at >= listedOn! && e.newValue !== null && OFF_MARKET.has(e.newValue));
    daysOnMarket = Math.max(0, Math.floor(((ended?.at ?? now).getTime() - listedOn.getTime()) / DAY));
  }

  const priceChanges: PriceChange[] = [];
  for (const e of sorted) {
    if (e.kind !== "prix") continue;
    const from = num(e.oldValue);
    const to = num(e.newValue);
    if (from === null || to === null || from === 0) continue;
    priceChanges.push({ at: e.at, from, to, change: round4(to / from - 1) });
  }

  const firstPrice = num(created?.newValue ?? null) ?? priceChanges[0]?.from ?? null;
  const totalChange = firstPrice && currentPrice && firstPrice !== currentPrice ? round4(currentPrice / firstPrice - 1) : null;

  return { listedOn, daysOnMarket, priceChanges, firstPrice, totalChange };
}
