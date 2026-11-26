/**
 * Annonces exportables au format SeLoger « Poliris » (D-070) : biens sous mandat, visibles par
 * l'utilisateur (RLS), dont les mentions obligatoires sont complètes. Calcul en mémoire, en une
 * seule lecture des biens.
 */
import { withTenant } from "@immopilot/db";
import {
  buildListingText, checkListing, isPublishable, listingParts, priceExcludingFees, type EnergyClass, type ListingInput, type PolirisListing,
} from "@immopilot/domain";
import type { AgencyContext } from "../agency/context";
import { getAgencySettings } from "../agency/settings";
import { getTenantPool } from "../server/db";
import { toProperty, type Property } from "./data";
import { splitLabel } from "./listing";

export interface ExportCandidate {
  property: Property;
  listing: Omit<PolirisListing, "photos">;
}

export async function polirisCandidates(ctx: AgencyContext): Promise<{ ready: ExportCandidate[]; incomplete: number }> {
  const [rows, settings] = await Promise.all([
    withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
      (await c.query("SELECT * FROM app.properties WHERE status = 'mandat' ORDER BY created_at LIMIT 500")).rows.map(toProperty)),
    getAgencySettings(ctx),
  ]);
  const ready: ExportCandidate[] = [];
  let incomplete = 0;
  for (const p of rows) {
    const { postcode, city } = splitLabel(p.address_label);
    const input: ListingInput = {
      type: p.type, city, postcode, surface: p.surface, rooms: p.rooms, price: p.price,
      dpeClass: p.dpe_class as EnergyClass | null, gesClass: p.ges_class as EnergyClass | null,
      energyCostLow: p.energy_cost_low, energyCostHigh: p.energy_cost_high, energyCostYear: p.energy_cost_year,
      isCopro: p.is_copro, coproLots: p.copro_lots, coproAnnualCharges: p.copro_annual_charges, coproProcedure: p.copro_procedure,
      feesPayer: p.fees_payer, feesPercent: p.fees_percent, feeScheduleUrl: settings.feeScheduleUrl,
      title: p.listing_title, description: p.listing_description,
    };
    if (!p.price || !isPublishable(checkListing(input))) {
      incomplete += 1;
      continue;
    }
    const parts = listingParts(buildListingText(input));
    const street = /^(.*?)\s+\d{5}\s+.+$/.exec(p.address_label)?.[1] ?? "";
    const technicalId = p.id.replace(/-/g, "").slice(0, 30);
    ready.push({
      property: p,
      listing: {
        agencyCode: ctx.org.slug, reference: p.mandate_number ?? `IP-${technicalId.slice(0, 8)}`, technicalId,
        type: p.type, street, postcode, city, price: p.price,
        feesPayer: p.fees_payer, feesPercent: p.fees_percent,
        priceExcludingFees: p.fees_payer === "acquereur" && p.fees_percent ? priceExcludingFees(p.price, p.fees_percent) : null,
        surface: p.surface, rooms: p.rooms, title: parts.title, description: parts.body, features: p.features,
        exclusive: p.mandate_type === "exclusif", dpeClass: p.dpe_class, gesClass: p.ges_class,
        isCopro: p.is_copro, coproLots: p.copro_lots, coproAnnualCharges: p.copro_annual_charges,
      },
    });
  }
  return { ready, incomplete };
}
