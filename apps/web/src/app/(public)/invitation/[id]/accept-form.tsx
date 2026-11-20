"use client";
import { useActionState } from "react";
import { acceptInvitationAction, type ActionState } from "@/lib/agency/actions";
import { SubmitButton } from "@/ui/client";
import { Alert } from "@/ui/surface";

export function AcceptInvitationForm({ invitationId }: { invitationId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(acceptInvitationAction, {});
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <input type="hidden" name="invitationId" value={invitationId} />
      <SubmitButton className="w-full" pendingLabel="Un instant…">
        Accepter l&apos;invitation
      </SubmitButton>
    </form>
  );
}
