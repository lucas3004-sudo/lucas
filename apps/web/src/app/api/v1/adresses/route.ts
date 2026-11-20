/**
 * Suggestions d'adresses (BAN) pour le formulaire de dossier. Réservé aux utilisateurs connectés.
 * Ne renvoie que le libellé et l'identifiant BAN : les coordonnées sont recalculées côté serveur
 * à la création du dossier.
 */
import { geocode } from "@immopilot/integrations";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/agency/context";

export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ type: "about:blank", title: "Non connecté", status: 401 }, { status: 401, headers: { "content-type": "application/problem+json" } });
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 3) return NextResponse.json({ results: [] });
  try {
    const results = (await geocode(q.slice(0, 200), { limit: 6 }))
      .filter((a) => a.type === "housenumber" || a.type === "street")
      .map((a) => ({ label: a.label, banId: a.banId, type: a.type }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { type: "about:blank", title: "Service d'adresses indisponible", status: 503, code: "source_unavailable" },
      { status: 503, headers: { "content-type": "application/problem+json" } },
    );
  }
}
