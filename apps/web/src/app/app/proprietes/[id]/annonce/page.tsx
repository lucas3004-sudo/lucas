import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAgency } from "@/lib/agency/context";
import { PORTAL_IDS, PORTALS } from "@immopilot/domain";
import { setPortalAction } from "@/lib/crm/actions";
import { listingFor, propertyPortals } from "@/lib/crm/listing";
import { CopyTextButton, SubmitButton } from "@/ui/client";
import { Input } from "@/ui/form";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/ui/surface";
import { canEditRecord } from "../../../_crm/parts";
import { ListingForm } from "./listing-form";

export const metadata: Metadata = { title: "Annonce", robots: { index: false } };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" });
const day = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

const DIFFUSION_MESSAGES: Record<string, { tone: "success" | "danger"; text: string }> = {
  ok: { tone: "success", text: "Diffusion mise à jour." },
  lien: { tone: "danger", text: "Lien invalide : copiez l'adresse complète de l'annonce, qui commence par https://." },
  droits: { tone: "danger", text: "Seul le responsable du bien (ou le gérant, un manager, un assistant) peut modifier sa diffusion." },
};

export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ diffusion?: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const ctx = await requireAgency();
  const [listing, portals, { diffusion }] = await Promise.all([listingFor(ctx, id.data), propertyPortals(ctx, id.data), searchParams]);
  if (!listing) notFound();
  const { property, settings, checks, publishable, missing, text, parts } = listing;
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

      <div id="diffusion" className="mt-4 scroll-mt-20">
      <Card>
        <CardHeader
          title="Diffusion sur les portails"
          description="Publiez avec les abonnements de l'agence (SeLoger, Leboncoin, Bien'ici…), puis notez-le ici : quand le bien sera vendu, ImmoPilot vous rappellera de retirer chaque annonce."
        />
        <CardBody className="space-y-5 text-sm">
          {diffusion && DIFFUSION_MESSAGES[diffusion] ? <Alert tone={DIFFUSION_MESSAGES[diffusion].tone}>{DIFFUSION_MESSAGES[diffusion].text}</Alert> : null}
          <div className="rounded-[var(--radius-control)] bg-surface-muted p-4">
            <p className="font-medium text-ink">Pack annonce</p>
            <p className="mt-1 text-xs text-ink-muted">
              Le titre et la description vont dans les champs du même nom sur chaque portail ; le pack contient le texte et toutes les photos, prêts à envoyer.
            </p>
            {publishable ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyTextButton text={parts.title} label="Copier le titre" />
                <CopyTextButton text={parts.body} label="Copier la description" />
                <a
                  href={`/api/v1/proprietes/${property.id}/pack`}
                  download
                  className="press inline-flex h-9 items-center rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-muted"
                >
                  Télécharger le pack (texte et photos)
                </a>
              </div>
            ) : (
              <p className="mt-3 text-xs text-danger">Disponible quand les mentions obligatoires sont complètes.</p>
            )}
          </div>
          <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line" aria-label="Portails">
            {PORTAL_IDS.map((portal) => {
              const row = portals.find((p) => p.portal === portal);
              const name = PORTALS[portal];
              return (
                <li key={portal} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" data-testid={`portail-${portal}`}>
                  <div className="min-w-40 flex-1">
                    <p className="font-medium text-ink">{name}</p>
                    <p className="text-xs text-ink-muted">
                      {row?.status === "publie" ? (
                        <>
                          <Badge tone="success">En ligne</Badge> depuis le {day(row.published_on)}
                          {row.url ? (
                            <>
                              {" · "}
                              <a href={row.url} target="_blank" rel="noopener noreferrer nofollow" className="underline">Voir l&apos;annonce</a>
                            </>
                          ) : null}
                        </>
                      ) : row?.status === "retire" && row.removed_on ? (
                        <>Retirée le {day(row.removed_on)}</>
                      ) : (
                        "Non publié"
                      )}
                    </p>
                  </div>
                  {canEdit ? (
                    row?.status === "publie" ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={setPortalAction}>
                          <input type="hidden" name="id" value={property.id} />
                          <input type="hidden" name="portal" value={portal} />
                          <input type="hidden" name="op" value="retirer" />
                          <SubmitButton size="sm" variant="secondary" aria-label={`Annonce retirée de ${name}`}>Annonce retirée</SubmitButton>
                        </form>
                        <form action={setPortalAction}>
                          <input type="hidden" name="id" value={property.id} />
                          <input type="hidden" name="portal" value={portal} />
                          <input type="hidden" name="op" value="supprimer" />
                          <SubmitButton size="sm" variant="ghost" aria-label={`Annuler : jamais publié sur ${name}`}>Annuler</SubmitButton>
                        </form>
                      </div>
                    ) : (
                      <form action={setPortalAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={property.id} />
                        <input type="hidden" name="portal" value={portal} />
                        <input type="hidden" name="op" value="publier" />
                        <label className="sr-only" htmlFor={`url-${portal}`}>Lien de l&apos;annonce sur {name} (facultatif)</label>
                        <Input id={`url-${portal}`} name="url" type="url" inputMode="url" placeholder="Lien de l'annonce (facultatif)" className="h-9 w-64" />
                        <SubmitButton size="sm" variant="secondary" aria-label={`Publiée sur ${name}`}>
                          {row?.status === "retire" ? "Republiée" : "Publiée"}
                        </SubmitButton>
                      </form>
                    )
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-ink-muted">
            Chaque portail reste payé par l&apos;agence avec son propre abonnement. L&apos;envoi automatique vers tous les portails en un clic
            arrivera avec une passerelle de multidiffusion partenaire.
          </p>
        </CardBody>
      </Card>
      </div>
    </>
  );
}
