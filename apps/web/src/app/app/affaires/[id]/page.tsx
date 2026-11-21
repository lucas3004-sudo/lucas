import { utcToParisLocal } from "@immopilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAgency } from "@/lib/agency/context";
import { agencyMembers } from "@/lib/crm/data";
import { setDealStageAction, toggleChecklistAction } from "@/lib/deals/actions";
import { getDeal } from "@/lib/deals/data";
import { dealDeadlines } from "@/lib/deals/deadlines";
import { CHECKLIST, DEAL_STAGES, STAGE_FLOW, type DealStage } from "@/lib/deals/labels";
import { fmt } from "@/lib/format";
import { cn } from "@/ui/cn";
import { ConfirmSubmit, SubmitButton } from "@/ui/client";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/ui/surface";
import { memberName } from "../../_crm/parts";
import { DealDatesForm } from "../deal-forms";

export const metadata: Metadata = { title: "Affaire", robots: { index: false } };

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const ctx = await requireAgency();
  const [deal, members] = await Promise.all([getDeal(ctx, id.data), agencyMembers(ctx.org.id)]);
  if (!deal) notFound();
  const editable = deal.owner_user_id === ctx.user.id || ["gerant", "manager", "assistant"].includes(ctx.role);
  const today = utcToParisLocal(new Date()).slice(0, 10);
  const deadlines = dealDeadlines(deal, today);
  const position = STAGE_FLOW.indexOf(deal.stage);
  const next: DealStage | undefined = position >= 0 ? STAGE_FLOW[position + 1] : undefined;
  const open = deal.stage !== "acte" && deal.stage !== "abandon";

  return (
    <>
      <PageHeader
        title={deal.property_label}
        description={
          <>
            Affaire suivie par {memberName(members, deal.owner_user_id)}
            {deal.price !== null ? ` · prix convenu ${fmt.euros(deal.price)}` : ""}
            {deal.fees !== null ? ` · honoraires ${fmt.euros(deal.fees)}` : ""}
          </>
        }
        actions={
          <Link href={`/app/proprietes/${deal.property_id}`} className="text-sm font-medium text-brand-text underline">
            Voir le bien
          </Link>
        }
      />

      <ol aria-label="Étapes de l'affaire" className="mb-4 flex flex-wrap gap-2">
        {STAGE_FLOW.map((s, i) => (
          <li
            key={s}
            aria-current={s === deal.stage ? "step" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              s === deal.stage ? "bg-brand text-brand-ink" : position >= 0 && i < position ? "bg-success-soft text-success" : "bg-surface-muted text-ink-muted",
            )}
          >
            {i + 1}. {DEAL_STAGES[s]}
          </li>
        ))}
        {deal.stage === "abandon" ? <li><Badge tone="danger">Abandonnée</Badge></li> : null}
      </ol>

      {editable && open ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {next ? (
            <form action={setDealStageAction}>
              <input type="hidden" name="id" value={deal.id} />
              <input type="hidden" name="stage" value={next} />
              <SubmitButton>Passer à : {DEAL_STAGES[next]}</SubmitButton>
            </form>
          ) : null}
          <form action={setDealStageAction}>
            <input type="hidden" name="id" value={deal.id} />
            <input type="hidden" name="stage" value="abandon" />
            <ConfirmSubmit message="Marquer cette affaire comme abandonnée ? Le bien redeviendra « sous mandat » s'il n'a pas d'autre affaire en cours." size="md">
              Abandonner
            </ConfirmSubmit>
          </form>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Échéances" description="Calculées à partir des dates saisies. Indicatives : le notaire fait foi." />
            {deadlines.length === 0 ? (
              <CardBody>
                <p className="text-sm text-ink-muted">
                  {open ? "Renseignez les dates ci-dessous (notification du compromis, prêt, acte) pour suivre les échéances." : "Aucune échéance : l'affaire est terminée."}
                </p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {deadlines.map((d) => (
                  <li key={d.key} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1 text-sm text-ink">{d.label}</span>
                    <span className="tabular text-sm font-medium text-ink">{fmt.date(d.date)}</span>
                    <Badge tone={d.daysLeft < 0 ? "danger" : d.daysLeft <= 3 ? "warning" : "neutral"}>
                      {d.daysLeft < 0 ? `Dépassée de ${-d.daysLeft} j` : d.daysLeft === 0 ? "Aujourd'hui" : `Dans ${d.daysLeft} j`}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            {deadlines.some((d) => d.key === "retractation") ? (
              <p className="border-t border-line px-5 py-2.5 text-xs text-ink-muted">
                Rétractation : 10 jours à compter du lendemain de la première présentation de la lettre ou de la remise en main propre
                (art. L271-1 du Code de la construction et de l&apos;habitation), prorogés au premier jour ouvrable si le délai expire un
                samedi, un dimanche ou un jour férié.
              </p>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Dates et informations" />
            <DealDatesForm deal={deal} editable={editable} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Parties" />
            <CardBody className="space-y-1.5 text-sm">
              <p>
                <span className="text-ink-muted">Acquéreur : </span>
                {deal.buyer_contact_id && deal.buyer_name ? <Link href={`/app/contacts/${deal.buyer_contact_id}`} className="underline">{deal.buyer_name}</Link> : deal.buyer_contact_id ? "Contact privé d'un collègue" : "—"}
              </p>
              <p>
                <span className="text-ink-muted">Vendeur : </span>
                {deal.seller_contact_id && deal.seller_name ? <Link href={`/app/contacts/${deal.seller_contact_id}`} className="underline">{deal.seller_name}</Link> : deal.seller_contact_id ? "Contact privé d'un collègue" : "—"}
              </p>
              {deal.notary ? (
                <p>
                  <span className="text-ink-muted">Notaire(s) : </span>
                  {deal.notary}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Pièces par étape" description="Liste indicative, à adapter avec le notaire." />
            <div className="divide-y divide-line">
              {(Object.keys(CHECKLIST) as Array<keyof typeof CHECKLIST>).map((stage) => (
                <section key={stage} aria-label={DEAL_STAGES[stage]} className="px-5 py-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{DEAL_STAGES[stage]}</h3>
                  <ul className="space-y-1.5">
                    {CHECKLIST[stage].map((item) => {
                      const done = deal.checklist[item.key] === true;
                      return (
                        <li key={item.key} className="flex items-start gap-2">
                          {editable ? (
                            <form action={toggleChecklistAction}>
                              <input type="hidden" name="id" value={deal.id} />
                              <input type="hidden" name="key" value={item.key} />
                              <input type="hidden" name="done" value={done ? "0" : "1"} />
                              <button
                                type="submit"
                                aria-label={`${done ? "Décocher" : "Cocher"} : ${item.label}`}
                                aria-pressed={done}
                                className={cn(
                                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border text-[10px]",
                                  done ? "border-success bg-success text-white" : "border-line-strong bg-surface",
                                )}
                              >
                                {done ? "✓" : ""}
                              </button>
                            </form>
                          ) : (
                            <span aria-hidden className={cn("mt-0.5 size-4 shrink-0 rounded border", done ? "border-success bg-success" : "border-line-strong")} />
                          )}
                          <span className={cn("text-[13px]", done ? "text-ink-muted line-through" : "text-ink")}>{item.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
