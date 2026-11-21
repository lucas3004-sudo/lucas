import { sellerReportText } from "@immopilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgency } from "@/lib/agency/context";
import { listAppointments } from "@/lib/agenda/data";
import { reportForAppointment } from "@/lib/visits/data";
import { CopyTextButton } from "@/ui/client";
import { Alert, Card, CardHeader, PageHeader } from "@/ui/surface";
import { VisitReportForm } from "./report-form";

export const metadata: Metadata = { title: "Compte rendu de visite" };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
const UUID_RE = /^[0-9a-f-]{36}$/i;

export default async function VisitReportPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAgency();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const [visit] = await listAppointments(ctx, { id, limit: 1 });
  if (!visit || visit.kind !== "visite") notFound();
  const report = await reportForAppointment(ctx, id);
  const happened = visit.starts_at.getTime() <= Date.now();
  const canWrite = ctx.role !== "lecture" && (!report || report.author_user_id === ctx.user.id || ctx.role === "gerant" || ctx.role === "manager");
  const visitDate = dateFmt.format(visit.starts_at);
  const sellerText = report
    ? sellerReportText(
        { interest: report.interest, priceOpinion: report.price_opinion, nextStep: report.next_step, positives: report.positives, objections: report.objections },
        { visitDate, propertyLabel: visit.property_label, agentName: ctx.user.name },
      )
    : null;

  return (
    <>
      <PageHeader
        title="Compte rendu de visite"
        description={`${visit.title}, le ${visitDate}${visit.property_label ? `, ${visit.property_label}` : ""}. Sans IA : le texte pour le vendeur est assemblé à partir de vos réponses.`}
        actions={<Link href="/app/agenda" className="text-sm font-medium text-ink-muted hover:text-ink">Retour à l&apos;agenda</Link>}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Retour des visiteurs" />
          {visit.status === "annule" ? (
            <p className="px-5 py-4 text-sm text-ink-muted">Cette visite a été annulée.</p>
          ) : !happened ? (
            <p className="px-5 py-4 text-sm text-ink-muted">La visite n&apos;a pas encore eu lieu : le compte rendu se rédige après.</p>
          ) : canWrite ? (
            <VisitReportForm
              appointmentId={id}
              editing={Boolean(report)}
              initial={{
                interest: report?.interest ?? "",
                priceOpinion: report?.price_opinion ?? "",
                nextStep: report?.next_step ?? "",
                positives: report?.positives ?? "",
                objections: report?.objections ?? "",
              }}
            />
          ) : (
            <p className="px-5 py-4 text-sm text-ink-muted">Seuls l&apos;auteur du compte rendu, le gérant et les managers peuvent le modifier.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Texte pour le vendeur" description="Sans le nom des visiteurs. Relisez-le avant de l'envoyer : vous restez responsable de son contenu." />
          {sellerText ? (
            <div className="space-y-3 px-5 py-4">
              <p className="whitespace-pre-line rounded-[var(--radius-control)] border border-line bg-surface-muted px-4 py-3 text-sm text-ink" data-testid="seller-text">
                {sellerText}
              </p>
              <CopyTextButton text={sellerText} />
            </div>
          ) : (
            <div className="px-5 py-4">
              <Alert tone="brand">Le texte apparaîtra ici une fois le compte rendu enregistré.</Alert>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
