import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { switchAgencyAction } from "@/lib/agency/actions";
import { requireUser } from "@/lib/agency/context";
import { getAuth } from "@/lib/auth/server";
import { buttonClass, LinkButton } from "@/ui/button";

export const metadata: Metadata = { title: "Choisir une agence" };

export default async function ChooseAgencyPage() {
  await requireUser();
  const orgs = await getAuth().api.listOrganizations({ headers: await headers() });
  if (orgs.length === 0) redirect("/agence/nouvelle");

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Choisir une agence</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Vous êtes membre de plusieurs agences.</p>
      <ul className="mt-8 space-y-2">
        {orgs.map((org) => (
          <li key={org.id}>
            <form action={switchAgencyAction}>
              <input type="hidden" name="organizationId" value={org.id} />
              <button type="submit" className={buttonClass("secondary", "md", "w-full justify-between")}>
                <span className="truncate">{org.name}</span>
                <span aria-hidden className="text-ink-subtle">→</span>
              </button>
            </form>
          </li>
        ))}
      </ul>
      <LinkButton href="/agence/nouvelle" variant="ghost" className="mt-4 w-full">
        Créer une autre agence
      </LinkButton>
    </>
  );
}
