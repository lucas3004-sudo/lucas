import type { Metadata } from "next";
import { headers } from "next/headers";
import { cancelInvitationAction } from "@/lib/agency/actions";
import { requireAgency } from "@/lib/agency/context";
import { canManageTeam } from "@/lib/agency/rules";
import { assignableRoles, isAgencyRole, ROLE_LABELS } from "@/lib/auth/roles";
import { getAuth } from "@/lib/auth/server";
import { appUrl } from "@/lib/server/env";
import { buttonClass } from "@/ui/button";
import { CopyField } from "@/ui/client";
import { Badge, Card, CardHeader, PageHeader } from "@/ui/surface";
import { InviteForm, MemberActions } from "./team-forms";

export const metadata: Metadata = { title: "Équipe" };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" });

export default async function TeamPage() {
  const ctx = await requireAgency();
  const full = await getAuth().api.getFullOrganization({ headers: await headers(), query: { organizationId: ctx.org.id } });
  const members = [...(full?.members ?? [])].sort((a, b) => a.user.name.localeCompare(b.user.name, "fr"));
  const invitations = (full?.invitations ?? []).filter((i) => i.status === "pending");
  const manage = canManageTeam(ctx.role);
  const roles = assignableRoles(ctx.role).map((r) => ({ value: r, label: ROLE_LABELS[r] }));

  return (
    <>
      <PageHeader title="Équipe" description="Les membres de l'agence, leurs rôles et les invitations en attente." />

      {manage ? (
        <Card className="mb-4">
          <CardHeader
            title="Inviter un collaborateur"
            description="Sans service d'e-mail configuré, l'invitation prend la forme d'un lien à transmettre vous-même. Il expire après 7 jours."
          />
          <InviteForm roles={roles} />
        </Card>
      ) : null}

      <Card>
        <CardHeader title={`Membres (${members.length})`} />
        <ul className="divide-y divide-line">
          {members.map((m) => {
            const role = isAgencyRole(m.role) ? m.role : null;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand-text" aria-hidden>
                  {m.user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {m.user.name}
                    {m.userId === ctx.user.id ? <span className="ml-2 text-xs font-normal text-ink-muted">(vous)</span> : null}
                  </p>
                  <p className="truncate text-[13px] text-ink-muted">{m.user.email}</p>
                </div>
                {manage && m.userId !== ctx.user.id ? (
                  <MemberActions memberId={m.id} memberName={m.user.name} currentRole={m.role} roles={roles} />
                ) : (
                  <Badge tone={role === "gerant" ? "brand" : "neutral"}>{role ? ROLE_LABELS[role] : m.role}</Badge>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {manage && invitations.length > 0 ? (
        <Card className="mt-4">
          <CardHeader title={`Invitations en attente (${invitations.length})`} />
          <ul className="divide-y divide-line">
            {invitations.map((inv) => (
              <li key={inv.id} className="space-y-2.5 px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{inv.email}</p>
                  <Badge>{inv.role && isAgencyRole(inv.role) ? ROLE_LABELS[inv.role] : inv.role}</Badge>
                  <span className="text-xs text-ink-muted">expire le {dateFmt.format(new Date(inv.expiresAt))}</span>
                  <form action={cancelInvitationAction}>
                    <input type="hidden" name="invitationId" value={inv.id} />
                    <button type="submit" className={buttonClass("ghost", "sm")}>
                      Annuler
                    </button>
                  </form>
                </div>
                <CopyField value={`${appUrl()}/invitation/${inv.id}`} label={`Lien d'invitation pour ${inv.email}`} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
