import { AGENTS, LEVEL_LABELS } from "@immopilot/agents";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/agency/context";
import { runAgentAction, setAgentEnabledAction } from "@/lib/agents/actions";
import { agentCenterData, type MissionRow } from "@/lib/agents/data";
import { agencyMembers } from "@/lib/crm/data";
import { SubmitButton } from "@/ui/client";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/ui/surface";
import { memberName } from "../_crm/parts";

export const metadata: Metadata = { title: "Agents" };

const STATUS: Record<MissionRow["status"], { label: string; tone: "success" | "danger" | "warning" | "neutral" | "brand" }> = {
  en_cours: { label: "En cours", tone: "brand" },
  reussie: { label: "Réussie", tone: "success" },
  echouee: { label: "Échouée", tone: "danger" },
  attente_approbation: { label: "Approbation demandée", tone: "warning" },
  annulee: { label: "Annulée", tone: "neutral" },
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

export default async function AgentsPage() {
  const ctx = await requireAgency();
  if (ctx.role === "lecture") {
    return (
      <>
        <PageHeader title="Agents" />
        <Alert tone="warning">L&apos;Agent Center n&apos;est pas accessible avec le rôle « lecture seule ».</Alert>
      </>
    );
  }
  const [{ settings, missions, pending }, members] = await Promise.all([agentCenterData(ctx), agencyMembers(ctx.org.id)]);
  const totalPending = [...pending.values()].reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Agents"
        description="Agents déterministes : ils appliquent des règles écrites dans le code, sans IA ni coût. Chacun agit avec vos droits, uniquement via les outils de sa fiche, et rien d'important ne se fait sans approbation."
        actions={
          <Link href="/app/agents/approbations" className="text-sm font-medium text-brand-text underline">
            Approbations{totalPending ? ` (${totalPending} en attente)` : ""}
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {AGENTS.map((agent) => {
          const enabled = settings.get(agent.id) ?? true;
          const last = missions.find((m) => m.agent_id === agent.id);
          const waiting = pending.get(agent.id) ?? 0;
          const status = !enabled
            ? { label: "Désactivé", tone: "neutral" as const }
            : waiting
              ? { label: `${waiting} approbation(s) en attente`, tone: "warning" as const }
              : last?.status === "echouee"
                ? { label: "Dernière mission échouée", tone: "danger" as const }
                : { label: "Disponible", tone: "success" as const };
          return (
            <Card key={agent.id}>
              <CardHeader title={agent.name} description={agent.description} action={<Badge tone={status.tone}>{status.label}</Badge>} />
              <CardBody className="space-y-3 text-sm">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
                  <dt className="text-ink-muted">Mode</dt>
                  <dd className="text-ink">Déterministe (sans IA)</dd>
                  <dt className="text-ink-muted">Niveau maximal</dt>
                  <dd className="text-ink">{agent.maxPermission} · {LEVEL_LABELS[agent.maxPermission]}</dd>
                  <dt className="text-ink-muted">Outils</dt>
                  <dd className="break-words font-mono text-xs text-ink">{agent.tools.join(", ")}</dd>
                  <dt className="text-ink-muted">Coût mesuré</dt>
                  <dd className="text-ink">0 € (aucun appel à un modèle)</dd>
                  <dt className="text-ink-muted">Version</dt>
                  <dd className="text-ink">{agent.version}</dd>
                </dl>
                {last ? (
                  <p className="text-[13px] text-ink-muted">
                    Dernière mission : {dateFmt.format(last.started_at)} · <Badge tone={STATUS[last.status].tone}>{STATUS[last.status].label}</Badge>{" "}
                    {last.summary.text ?? last.error ?? ""}
                  </p>
                ) : (
                  <p className="text-[13px] text-ink-muted">Aucune mission pour le moment.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {enabled ? (
                    <form action={runAgentAction}>
                      <input type="hidden" name="agentId" value={agent.id} />
                      <SubmitButton size="sm" pendingLabel="Mission en cours…">Lancer {agent.name}</SubmitButton>
                    </form>
                  ) : null}
                  {ctx.role === "gerant" ? (
                    <form action={setAgentEnabledAction}>
                      <input type="hidden" name="agentId" value={agent.id} />
                      <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
                      <SubmitButton size="sm" variant="secondary">{enabled ? "Désactiver" : "Activer"}</SubmitButton>
                    </form>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <CardHeader title="Missions récentes" description={ctx.role === "gerant" || ctx.role === "manager" ? "Toute l'agence." : "Vos missions."} />
        {missions.length === 0 ? (
          <p className="px-5 py-4 text-sm text-ink-muted">Aucune mission.</p>
        ) : (
          <div role="region" aria-label="Dernières missions (défilable)" tabIndex={0} className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th scope="col" className="px-5 py-2 font-medium">Date</th>
                  <th scope="col" className="px-3 py-2 font-medium">Agent</th>
                  <th scope="col" className="px-3 py-2 font-medium">Lancée par</th>
                  <th scope="col" className="px-3 py-2 font-medium">Statut</th>
                  <th scope="col" className="px-3 py-2 font-medium">Résultat</th>
                  <th scope="col" className="px-5 py-2 text-right font-medium">Étapes · coût</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {missions.map((m) => (
                  <tr key={m.id}>
                    <td className="px-5 py-2 text-ink-muted">{dateFmt.format(m.started_at)}</td>
                    <td className="px-3 py-2 text-ink">{AGENTS.find((a) => a.id === m.agent_id)?.name ?? m.agent_id} <span className="text-xs text-ink-subtle">v{m.agent_version}</span></td>
                    <td className="px-3 py-2 text-ink-muted">{memberName(members, m.requested_by)}</td>
                    <td className="px-3 py-2"><Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge></td>
                    <td className="px-3 py-2 text-ink">{m.summary.text ?? m.error ?? "—"}</td>
                    <td className="tabular px-5 py-2 text-right text-ink-muted">{m.steps} · {Number(m.cost_micro_usd) === 0 ? "0 €" : `${Number(m.cost_micro_usd) / 1_000_000} $`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
