import { buildListingText, checkListing, isPublishable, type EnergyClass, type ListingInput } from "@immopilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAgency } from "@/lib/agency/context";
import { getAgencySettings } from "@/lib/agency/settings";
import { getProperty } from "@/lib/crm/data";
import { CopyTextButton } from "@/ui/client";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/ui/surface";
import { canEditRecord } from "../../../_crm/parts";
import { ListingForm } from "./listing-form";

export const metadata: Metadata = { title: "Annonce", robots: { index: false } };

/** « 8 Boulevard du Port 80000 Amiens » → code postal et ville (libellé BAN). */
function splitLabel(label: string): { postcode: string; city: string } {
  const m = /(\d{5})\s+(.+)$/.exec(label);
  return m ? { postcode: m[1]!, city: m[2]! } : { postcode: "", city: label };
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const ctx = await requireAgency();
  const [property, settings] = await Promise.all([getProperty(ctx, id.data), getAgencySettings(ctx)]);
  if (!property) notFound();
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
  const publishable = isPublishable(checks);
  const missing = checks.filter((c) => c.status === "manquante").length;
  const text = buildListingText(input);
  const canEdit = canEditRecord(ctx, property.owner_user_id);

  return (
    <>
      <PageHeader
        title="Annonce"
        description={
          <>
            <Link href={`/app/proprietes/${property.id}`} className="underline">{property.address_label}</Link> · texte produit à partir des données du
            bien, <strong>sans IA</strong>, avec contrôle des mentions obligatoires.
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Mentions obligatoires"
              description="Contrôle indicatif (fiche juridique, à faire valider par l'avocat avant commercialisation)."
              action={<Badge tone={publishable ? "success" : "danger"}>{publishable ? "Complète" : `${missing} manquante(s)`}</Badge>}
            />
            <ul className="divide-y divide-line">
              {checks.map((c) => (
                <li key={c.key} className="flex gap-3 px-5 py-2.5">
                  <span aria-hidden className={c.status === "ok" ? "text-success" : "text-danger"}>{c.status === "ok" ? "✓" : "✗"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">{c.label}</span>
                    <span className="block text-xs text-ink-muted">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            {!settings.feeScheduleUrl ? (
              <CardBody>
                <p className="text-xs text-ink-muted">
                  Le lien du barème se règle une fois pour toute l&apos;agence dans les{" "}
                  <Link href="/app/parametres" className="underline">paramètres</Link> (gérant ou manager).
                </p>
              </CardBody>
            ) : null}
          </Card>
          {canEdit ? (
            <Card>
              <CardHeader title="Compléter l'annonce" />
              <ListingForm property={property} />
            </Card>
          ) : (
            <Alert tone="warning">Seul le responsable du bien (ou le gérant, un manager, un assistant) peut compléter l&apos;annonce.</Alert>
          )}
        </div>

        <Card>
          <CardHeader
            title="Texte de l'annonce"
            description="Relisez-le avant toute publication : vous en restez responsable."
            action={publishable ? <CopyTextButton text={text} label="Copier l'annonce" /> : null}
          />
          {!publishable ? (
            <div className="px-5 pt-4">
              <Alert tone="danger">Copie bloquée tant que {missing} mention(s) obligatoire(s) manque(nt). Complétez les champs à gauche.</Alert>
            </div>
          ) : null}
          <CardBody>
            <pre data-testid="listing-text" className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">{text}</pre>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
