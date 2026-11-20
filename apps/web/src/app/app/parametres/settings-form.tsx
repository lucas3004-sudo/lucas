"use client";
import { useActionState } from "react";
import { updateSettingsAction, type ActionState } from "@/lib/agency/actions";
import { SubmitButton } from "@/ui/client";
import { Field, Input } from "@/ui/form";
import { Alert } from "@/ui/surface";

const VISIBILITY = [
  {
    value: "agency",
    label: "Partagés avec l'agence",
    detail: "Toute l'équipe voit les nouveaux contacts et biens. Chacun ne modifie que les siens.",
  },
  {
    value: "private",
    label: "Privés",
    detail: "Seuls le responsable, le gérant et les managers les voient. Le matching signale les correspondances sans révéler l'identité.",
  },
] as const;

export function SettingsForm({
  name,
  defaultVisibility,
  canEdit,
  canRename,
}: {
  name: string;
  defaultVisibility: "private" | "agency";
  canEdit: boolean;
  canRename: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateSettingsAction, {});
  return (
    <form action={action} className="space-y-6 px-5 py-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div className="max-w-md">
        <Field label="Nom de l'agence" htmlFor="name" hint={canRename ? undefined : "Seul le gérant peut renommer l'agence."}>
          <Input id="name" name="name" defaultValue={name} required minLength={2} maxLength={80} readOnly={!canRename} disabled={!canEdit} />
        </Field>
      </div>

      <fieldset disabled={!canEdit}>
        <legend className="text-[13px] font-medium text-ink">Visibilité par défaut des nouveaux contacts et biens</legend>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {VISIBILITY.map((v) => (
            <label
              key={v.value}
              className="flex cursor-pointer gap-3 rounded-[var(--radius-control)] border border-line p-3.5 has-checked:border-brand has-checked:bg-brand-soft"
            >
              <input type="radio" name="defaultVisibility" value={v.value} defaultChecked={defaultVisibility === v.value} className="mt-0.5 accent-[var(--brand)]" />
              <span>
                <span className="block text-sm font-medium text-ink">{v.label}</span>
                <span className="mt-0.5 block text-[13px] text-ink-muted">{v.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {canEdit ? <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton> : null}
    </form>
  );
}
