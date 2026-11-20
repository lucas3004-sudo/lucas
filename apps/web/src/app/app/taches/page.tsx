import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/agency/context";
import { agencyMembers, listTasks } from "@/lib/crm/data";
import { cn } from "@/ui/cn";
import { Card, CardHeader, PageHeader } from "@/ui/surface";
import { TaskForm } from "../_crm/forms";
import { EmptyState } from "../_crm/parts";
import { TaskList } from "./task-list";

export const metadata: Metadata = { title: "Tâches" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const ctx = await requireAgency();
  const scope = (await searchParams).vue === "toutes" ? "team" : "mine";
  const [tasks, members] = await Promise.all([listTasks(ctx, scope), agencyMembers(ctx.org.id)]);
  const seesTeam = ctx.role === "gerant" || ctx.role === "manager";
  const tab = (active: boolean) =>
    cn("rounded-[var(--radius-control)] px-3 py-1.5 text-sm", active ? "bg-brand-soft font-medium text-brand-text" : "text-ink-muted hover:bg-surface-muted");

  return (
    <>
      <PageHeader title="Tâches" description="Rappels, relances et signalements entre collègues." />
      {ctx.role !== "lecture" ? (
        <Card className="mb-4">
          <CardHeader title="Nouvelle tâche" />
          <TaskForm members={members} meId={ctx.user.id} />
        </Card>
      ) : null}
      <nav aria-label="Filtre des tâches" className="mb-3 flex gap-1">
        <Link href="/app/taches" className={tab(scope === "mine")} aria-current={scope === "mine" ? "page" : undefined}>
          Mes tâches
        </Link>
        <Link href="/app/taches?vue=toutes" className={tab(scope === "team")} aria-current={scope === "team" ? "page" : undefined}>
          {seesTeam ? "Toute l'équipe" : "Mes tâches et celles que j'ai confiées"}
        </Link>
      </nav>
      <Card>
        {tasks.length ? <TaskList tasks={tasks} members={members} meId={ctx.user.id} /> : <EmptyState title="Aucune tâche." />}
      </Card>
    </>
  );
}
