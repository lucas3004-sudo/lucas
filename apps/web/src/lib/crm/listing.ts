/**
 * Annonce d'un bien (D-041, D-066) : texte produit sans IA à partir des données du bien, contrôle
 * des mentions obligatoires, et suivi de la diffusion sur les portails. Lectures sous RLS.
 */
import { withTenant } from "@immopilot/db";
import { buildListingText, checkListing, isPublishable, listingParts, type EnergyClass, type ListingInput, type PortalId } from "@immopilot/domain";
import type { AgencyContext } from "../agency/context";
import { getAgencySettings } from "../agency/settings";
import { getTenantPool } from "../server/db";
import { getProperty } from "./data";

/** « 8 Boulevard du Port 80000 Amiens » → code postal et ville (libellé BAN). */
export function splitLabel(label: string): { postcode: string; city: string } {
  const m = /(\d{5})\s+(.+)$/.exec(label);
  return m ? { postcode: m[1]!, city: m[2]! } : { postcode: "", city: label };
}

export async function listingFor(ctx: AgencyContext, propertyId: string) {
  const [property, settings] = await Promise.all([getProperty(ctx, propertyId), getAgencySettings(ctx)]);
  if (!property) return null;
  const { postcode, city } = splitLabel(property.address_label);
  const input: ListingInput = {
    type: property.type,
    city,
    postcode,
    surface: property.surface,
    rooms: property.rooms,
    price: property.price,
    dpeClass: property.dpe_class as EnergyClass | null,
    gesClass: property.ges_class as EnergyClass | null,
    energyCostLow: property.energy_cost_low,
    energyCostHigh: property.energy_cost_high,
    energyCostYear: property.energy_cost_year,
    isCopro: property.is_copro,
    coproLots: property.copro_lots,
    coproAnnualCharges: property.copro_annual_charges,
    coproProcedure: property.copro_procedure,
    feesPayer: property.fees_payer,
    feesPercent: property.fees_percent,
    feeScheduleUrl: settings.feeScheduleUrl,
    title: property.listing_title,
    description: property.listing_description,
  };
  const checks = checkListing(input);
  const text = buildListingText(input);
  return {
    property,
    settings,
    checks,
    publishable: isPublishable(checks),
    missing: checks.filter((c) => c.status === "manquante").length,
    text,
    parts: listingParts(text),
  };
}

export interface PortalRow {
  portal: PortalId;
  status: "publie" | "retire";
  url: string | null;
  published_on: string;
  removed_on: string | null;
}

/** Portails où le bien est (ou a été) publié. */
export async function propertyPortals(ctx: AgencyContext, propertyId: string): Promise<PortalRow[]> {
  return withTenant(getTenantPool(), { orgId: ctx.org.id, userId: ctx.user.id }, async (_db, c) =>
    (await c.query<PortalRow>(
      `SELECT portal, status, url, to_char(published_on, 'YYYY-MM-DD') AS published_on, to_char(removed_on, 'YYYY-MM-DD') AS removed_on
       FROM app.property_portals WHERE property_id = $1`,
      [propertyId],
    )).rows);
}
