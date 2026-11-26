import { AGENTS } from "@immopilot/agents";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/agency/context";
import { decideApprovalAction } from "@/lib/agents/actions";
import { listApprovals, type ApprovalRow } from "@/lib/agents/data";
import { agencyMembers } from "@/lib/crm/data";
import { SubmitButton } from "@/ui/client";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/ui/surface";
import { memberName } from "../../_crm/parts";

export const metadata: Metadata = { title: "Approbations" };

const STATUS: Record<ApprovalRow["status"], { label: string; tone: "warning" | "success" | "neutral" | "danger" }> = {
  en_attente: { label: "En attente", tone: "warning" },
  approuvee: { label: "Approuvée", tone: "success" },
  refusee: { label: "Refusée", tone: "neutral" },
  expiree: { label: "Expirée", tone: "neutral" },
  echouee: { label: "Échec à l'exécution", tone: "danger" },
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

function Detail({ a }: { a: ApprovalRow }) {
  if (a.tool === "contacts.merge") {
    const keep = a.contacts.keepId;
    const remove = a.contacts.removeId;
    return (
      <p className="text-[13px] text-ink-muted">
        Conserver{" "}
        {keep ? <Link href={`/app/contacts/${a.payload.keepId as string}`} className="font-medium text-ink underline">{keep.name}</Link> : "un contact (non visible ou supprimé)"} et y rattacher{" "}
        {remove ? <Link href={`/app/contacts/${a.payload.removeId as string}`} className="font-medium text-ink underline">{remove.name}</Link> : "un contact (non visible ou supprimé)"}
        {" "}: consentements, profils, tâches, rendez-vous et affaires sont repris, puis le doublon est supprimé.
      </p>
    );
  }
  if (a.tool === "listing.applyDraft") {
    return (
      <div className="space-y-1.5 rounded-[var(--radius-control)] bg-surface-muted p-3 text-[13px]" data-testid="annonce-proposee">
        <p className="font-medium text-ink">{String(a.payload.title ?? "")}</p>
        <p className="whitespace-pre-line text-ink-muted">{String(a.payload.description ?? "")}</p>
        <p className="text-xs text-ink-subtle">
          Texte rédigé par l&apos;IA à partir des caractéristiques du bien : relisez-le. Une fois approuvé, il est enregistré dans l&apos;annonce du{" "}
          <Link href={`/app/proprietes/${String(a.payload.propertyId)}/annonce`} className="underline">bien</Link>, avec les mentions obligatoires ajoutées automatiquement.
        </p>
      </div>
    );
  }
  return null;
}

export default async function ApprovalsPage() {
  const ctx = await requireAgency();
  if (ctx.role === "lecture" || ctx.role === "assistant") {
    return (
      <>
        <PageHeader title="Approbations" />
        <Alert tone="warning">Les approbations sont réservées au gérant, aux managers et aux négociateurs (pour leurs propres missions).</Alert>
      </>
    );
  }
  const [approvals, members] = await Promise.all([listApprovals(ctx), agencyMembers(ctx.org.id)]);
  const canApprove = (a: ApprovalRow) =>
    a.status === "en_attente" &&
    (a.tool === "contacts.merge" ? ctx.role === "gerant" || ctx.role === "manager" : ctx.role === "gerant" || ctx.role === "manager" || a.requested_by === ctx.user.id);
  const canReject = (a: ApprovalRow) => a.status === "en_attente" && (ctx.role === "gerant" || ctx.role === "manager" || a.requested_by === ctx.user.id);

  return (
    <>
      <PageHeader
        title="Approbations"
        description="Les actions importantes (L2) ou externes et irréversibles (L3) proposées par un agent n'ont lieu qu'après votre décision. Une demande expire après 7 jours."
        actions={<Link href="/app/agents" className="text-sm font-medium text-brand-text underline">Retour aux agents</Link>}
      />
      <Card>
        <CardHeader title={`Demandes (${approvals.filter((a) => a.status === "en_attente").length} en attente)`} />
        {approvals.length === 0 ? (
          <p className="px-5 py-4 text-sm text-ink-muted">Aucune demande.</p>
        ) : (
          <ul className="divide-y divide-line">
            {approvals.map((a) => (
              <li key={a.id} className="space-y-2 px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
                  <Badge>{a.level}</Badge>
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink">{a.title}</span>
                  <span className="text-xs text-ink-muted">
                    {AGENTS.find((x) => x.id === a.agent_id)?.name ?? a.agent_id} · demandé par {memberName(members, a.requested_by)} le {dateFmt.format(a.created_at)}
                  </span>
                </div>
                <Detail a={a} />
                {a.status === "echouee" && a.result ? <p className="text-[13px] text-danger">{String(a.result.erreur ?? "")}</p> : null}
                {a.decided_by ? <p className="text-xs text-ink-muted">Décidée par {memberName(members, a.decided_by)}{a.decided_at ? ` le ${dateFmt.format(a.decided_at)}` : ""}.</p> : null}
                {canApprove(a) || canReject(a) ? (
                  <div className="flex gap-2">
                    {canApprove(a) ? (
                      <form action={decideApprovalAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="decision" value="approuver" />
                        <SubmitButton size="sm">Approuver</SubmitButton>
                      </form>
                    ) : (
                      <span className="text-xs text-ink-muted">Fusion réservée au gérant et aux managers.</span>
                    )}
                    {canReject(a) ? (
                      <form action={decideApprovalAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="decision" value="refuser" />
                        <SubmitButton size="sm" variant="secondary">Refuser</SubmitButton>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
