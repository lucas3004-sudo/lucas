"use client";
/** Parcours de la page publique (D-067) : adresse et bien, fourchette, puis demande de rappel. */
import { useActionState } from "react";
import { publicEstimationAction, type EstimationState } from "@/lib/public/actions";
import { SubmitButton } from "@/ui/client";
import { Check, Field, Input, Select } from "@/ui/form";
import { Alert, Card, CardBody } from "@/ui/surface";

const euros = (n: number) => `${n.toLocaleString("fr-FR")} €`;

export function EstimationFlow({ slug, agency }: { slug: string; agency: string }) {
  const [state, action] = useActionState<EstimationState, FormData>(publicEstimationAction, { step: "saisie" });

  if (state.step === "envoye") {
    return (
      <Card>
        <CardBody className="space-y-2">
          <p className="font-display text-xl font-semibold text-ink">Merci, votre demande est envoyée.</p>
          <p className="text-sm text-ink-muted">Un conseiller de {state.agency} vous recontacte au sujet de votre projet.</p>
        </CardBody>
      </Card>
    );
  }

  if (state.step === "resultat") {
    return (
      <div className="space-y-4">
        <Card>
          <CardBody className="space-y-2">
            <p className="text-xs text-ink-muted">{state.address}</p>
            {state.estimate ? (
              <>
                <p className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink" data-testid="fourchette">
                  Entre {euros(state.estimate.low)} et {euros(state.estimate.high)}
                </p>
                <p className="text-sm text-ink-muted">
                  D&apos;après {state.estimate.comparables} ventes réelles de biens comparables dans un rayon de {state.estimate.radiusKm.toLocaleString("fr-FR")} km
                  (données publiques DVF{state.estimate.until ? `, jusqu'au ${new Date(state.estimate.until).toLocaleDateString("fr-FR")}` : ""}).
                </p>
              </>
            ) : (
              <p className="text-sm text-ink" data-testid="fourchette">
                Il y a trop peu de ventes comparables récentes autour de ce bien pour donner une fourchette fiable en ligne. Un conseiller peut vous donner une estimation précise.
              </p>
            )}
            <p className="text-xs text-ink-subtle">Estimation indicative, pas une expertise : l&apos;état du bien, l&apos;étage ou la vue peuvent la faire varier.</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <form action={action} className="space-y-4">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="etape" value="contact" />
              <p className="font-medium text-ink">Être recontacté par {agency}</p>
              {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prénom" htmlFor="prenom"><Input id="prenom" name="prenom" autoComplete="given-name" maxLength={80} /></Field>
                <Field label="Nom" htmlFor="nom"><Input id="nom" name="nom" autoComplete="family-name" maxLength={120} required /></Field>
                <Field label="E-mail" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" maxLength={200} /></Field>
                <Field label="Téléphone" htmlFor="telephone"><Input id="telephone" name="telephone" type="tel" autoComplete="tel" maxLength={30} /></Field>
              </div>
              {/* Champ piège : invisible pour les personnes, rempli par les robots. */}
              <div className="hidden" aria-hidden="true">
                <label htmlFor="site">Site web</label>
                <input id="site" name="site" tabIndex={-1} autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Check name="accord_email" label={`J'accepte que ${agency} me contacte par e-mail au sujet de mon projet de vente.`} />
                <Check name="accord_telephone" label={`J'accepte que ${agency} me contacte par téléphone au sujet de mon projet de vente.`} />
              </div>
              <p className="text-xs text-ink-muted">
                Vos coordonnées sont transmises uniquement à {agency}, responsable de leur traitement, pour vous recontacter au sujet de ce bien. Elles
                ne sont ni revendues ni utilisées pour autre chose. Vous pouvez à tout moment retirer votre accord, consulter ou faire supprimer vos
                données en le demandant à l&apos;agence.
              </p>
              <SubmitButton pendingLabel="Envoi…">Envoyer ma demande</SubmitButton>
            </form>
          </CardBody>
        </Card>
      </div>
    );
  }

  const v = state.values;
  return (
    <Card>
      <CardBody>
        <form action={action} className="space-y-4">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="etape" value="estimer" />
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
          <Field label="Adresse du bien" htmlFor="adresse" hint="Numéro, rue et ville, par exemple « 8 boulevard du Port, Amiens ».">
            <Input id="adresse" name="adresse" autoComplete="street-address" defaultValue={v?.adresse} maxLength={200} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type de bien" htmlFor="type">
              <Select id="type" name="type" defaultValue={v?.type || "Appartement"}>
                <option value="Appartement">Appartement</option>
                <option value="Maison">Maison</option>
              </Select>
            </Field>
            <Field label="Surface (m²)" htmlFor="surface">
              <Input id="surface" name="surface" inputMode="decimal" defaultValue={v?.surface} required />
            </Field>
            <Field label="Pièces" htmlFor="pieces">
              <Input id="pieces" name="pieces" inputMode="numeric" defaultValue={v?.pieces} />
            </Field>
          </div>
          <SubmitButton pendingLabel="Calcul…">Voir l&apos;estimation</SubmitButton>
        </form>
      </CardBody>
    </Card>
  );
}
