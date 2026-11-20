import { redirect } from "next/navigation";
import { getSession } from "@/lib/agency/context";

export default async function Home() {
  const session = await getSession();
  redirect(session ? (session.session.activeOrganizationId ? "/app" : "/agence") : "/connexion");
}
