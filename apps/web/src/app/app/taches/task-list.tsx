import Link from "next/link";
import { completeTaskAction } from "@/lib/crm/actions";
import type { Task } from "@/lib/crm/data";
import { fmt } from "@/lib/format";
import { SubmitButton } from "@/ui/client";
import { Badge } from "@/ui/surface";
import { memberName, type Member } from "../_crm/parts";

const todayIso = () => new Date().toISOString().slice(0, 10);

export function TaskList({ tasks, members, meId }: { tasks: Task[]; members: Member[]; meId: string }) {
  const today = todayIso();
  return (
    <ul className="divide-y divide-line">
      {tasks.map((t) => {
        const done = t.status === "faite";
        const late = !done && t.due_on !== null && t.due_on < today;
        return (
          <li key={t.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
            <form action={completeTaskAction}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="done" value={done ? "0" : "1"} />
              <SubmitButton variant="secondary" size="sm" className="w-28">
                {done ? "Rouvrir" : "Marquer faite"}
              </SubmitButton>
            </form>
            <div className="min-w-0 flex-1">
              <p className={done ? "text-sm text-ink-muted line-through" : "text-sm font-medium text-ink"}>{t.title}</p>
              {t.details ? <p className="mt-0.5 whitespace-pre-line text-[13px] text-ink-muted">{t.details}</p> : null}
              <p className="mt-1 text-xs text-ink-muted">
                {t.assignee_user_id === meId ? "Pour moi" : `Pour ${memberName(members, t.assignee_user_id)}`}
                {t.created_by !== t.assignee_user_id ? ` · de ${t.created_by === meId ? "moi" : memberName(members, t.created_by)}` : ""}
                {t.contact_id ? (
                  <>
                    {" · "}
                    <Link href={`/app/contacts/${t.contact_id}`} className="underline">
                      contact
                    </Link>
                  </>
                ) : null}
                {t.property_id ? (
                  <>
                    {" · "}
                    <Link href={`/app/proprietes/${t.property_id}`} className="underline">
                      bien
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
            {t.due_on ? <Badge tone={late ? "danger" : "neutral"}>{late ? "En retard : " : "Pour le "}{fmt.date(t.due_on)}</Badge> : null}
          </li>
        );
      })}
    </ul>
  );
}
