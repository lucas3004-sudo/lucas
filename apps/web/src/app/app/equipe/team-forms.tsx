"use client";
import { useActionState, useState } from "react";
import { changeRoleAction, inviteMemberAction, removeMemberAction, type ActionState } from "@/lib/agency/actions";
import { buttonClass } from "@/ui/button";
import { CopyField, SubmitButton } from "@/ui/client";
import { Field, Input, Select } from "@/ui/form";
import { Alert } from "@/ui/surface";

type RoleOption = { value: string; label: string };

export function InviteForm({ roles }: { roles: RoleOption[] }) {
  const [state, action] = useActionState<ActionState, FormData>(inviteMemberAction, {});
  return (
    <form action={action} className="space-y-4 px-5 py-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? (
        <div className="space-y-2">
          <Alert tone="success">{state.success} Transmettez-lui ce lien :</Alert>
          {state.link ? <CopyField value={state.link} label="Lien d'invitation" /> : null}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_auto] sm:items-end">
        <Field label="Adresse e-mail" htmlFor="invite-email">
          <Input id="invite-email" name="email" type="email" required autoComplete="off" />
        </Field>
        <Field label="Rôle" htmlFor="invite-role">
          <Select id="invite-role" name="role" defaultValue="negociateur">
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton pendingLabel="Création…">Créer l&apos;invitation</SubmitButton>
      </div>
    </form>
  );
}

export function MemberActions({
  memberId,
  memberName,
  currentRole,
  roles,
}: {
  memberId: string;
  memberName: string;
  currentRole: string;
  roles: RoleOption[];
}) {
  const [roleState, roleAction] = useActionState<ActionState, FormData>(changeRoleAction, {});
  const [removeState, removeAction] = useActionState<ActionState, FormData>(removeMemberAction, {});
  const [confirming, setConfirming] = useState(false);
  const canEdit = roles.some((r) => r.value === currentRole);
  const error = roleState.error ?? removeState.error;

  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit ? (
          <form action={roleAction} className="flex items-center gap-2">
            <input type="hidden" name="memberId" value={memberId} />
            <label htmlFor={`role-${memberId}`} className="sr-only">
              Rôle de {memberName}
            </label>
            <select
              id={`role-${memberId}`}
              name="role"
              defaultValue={currentRole}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="h-8 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2 text-[13px] text-ink"
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </form>
        ) : (
          <span className="text-[13px] text-ink-muted">Gérant</span>
        )}
        {canEdit ? (
          confirming ? (
            <form action={removeAction} className="flex items-center gap-1.5">
              <input type="hidden" name="memberId" value={memberId} />
              <SubmitButton variant="danger" size="sm" pendingLabel="Retrait…">
                Confirmer le retrait
              </SubmitButton>
              <button type="button" onClick={() => setConfirming(false)} className={buttonClass("ghost", "sm")}>
                Annuler
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={buttonClass("ghost", "sm")}>
              Retirer
            </button>
          )
        ) : null}
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {roleState.success ? <p className="text-xs text-success">{roleState.success}</p> : null}
    </div>
  );
}
