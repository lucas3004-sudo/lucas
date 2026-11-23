"use server";
/**
 * Page publique « Estimez votre bien » (D-067) : 1) estimation indicative à partir de l'adresse,
 * 2) demande de rappel avec consentement, qui arrive dans le CRM de l'agence.
 * Protections : champ piège invisible, délai minimal, limites par adresse IP et par agence (base).
 */
import { normalizeEmail } from "@immopilot/domain";
import { headers } from "next/headers";
import { z } from "zod";
import { getTenantPool } from "../server/db";
import { findAddress, ipHash, publicEstimate, publicEstimationPage, type PublicEstimate } from "./estimation";

export type EstimationState =
  | { step: "saisie"; error?: string; values?: { adresse: string; type: string; surface: string; pieces: string } }
  | { step: "resultat"; address: string; type: "Appartement" | "Maison"; surface: number; rooms: number | null; estimate: PublicEstimate | null; issuedAt: number; error?: string }
  | { step: "envoye"; agency: string };

const Property = z.object({
  type: z.enum(["Appartement", "Maison"]),
  surface: z.coerce.number().min(9).max(2000),
  pieces: z.union([z.literal("").transform(() => null), z.coerce.number().int().min(1).max(30)]),
});

const Lead = z.object({
  prenom: z.string().trim().max(80),
  nom: z.string().trim().min(1, "Indiquez votre nom.").max(120),
  email: z.union([z.literal(""), z.email("Adresse e-mail invalide.")]),
  telephone: z.string().trim().max(30).refine((v) => v === "" || /^[+\d][\d\s.-]{7,}$/.test(v), "Numéro de téléphone invalide."),
});

const MIN_DELAY_MS = 3000;

export async function publicEstimationAction(prev: EstimationState, form: FormData): Promise<EstimationState> {
  const slug = String(form.get("slug") ?? "");
  const page = await publicEstimationPage(slug);
  if (!page) return { step: "saisie", error: "Cette page d'estimation n'est pas disponible." };

  if (form.get("etape") === "estimer") {
    const values = {
      adresse: String(form.get("adresse") ?? "").slice(0, 200), type: String(form.get("type") ?? ""),
      surface: String(form.get("surface") ?? ""), pieces: String(form.get("pieces") ?? ""),
    };
    const parsed = Property.safeParse({ type: values.type, surface: values.surface.replace(",", "."), pieces: values.pieces });
    if (!parsed.success) return { step: "saisie", values, error: "Vérifiez le type de bien et la surface (entre 9 et 2 000 m²)." };
    const address = values.adresse.trim().length >= 5 ? await findAddress(values.adresse) : null;
    if (!address) return { step: "saisie", values, error: "Adresse introuvable : indiquez le numéro, la rue et la ville." };
    const estimate = await publicEstimate(address, parsed.data.type, parsed.data.surface, parsed.data.pieces);
    return { step: "resultat", address: address.label, type: parsed.data.type, surface: parsed.data.surface, rooms: parsed.data.pieces, estimate, issuedAt: Date.now() };
  }

  if (prev.step !== "resultat") return { step: "saisie" };
  // Robots : champ piège rempli, ou envoi plus rapide qu'un humain. On répond comme si c'était envoyé.
  if (String(form.get("site") ?? "") !== "" || Date.now() - prev.issuedAt < MIN_DELAY_MS) return { step: "envoye", agency: page.name };

  const lead = Lead.safeParse({
    prenom: String(form.get("prenom") ?? ""), nom: String(form.get("nom") ?? ""),
    email: String(form.get("email") ?? "").trim(), telephone: String(form.get("telephone") ?? ""),
  });
  if (!lead.success) return { ...prev, error: lead.error.issues[0]?.message ?? "Vérifiez vos coordonnées." };
  const channels = [
    ...(form.get("accord_email") === "on" && lead.data.email ? ["email"] : []),
    ...(form.get("accord_telephone") === "on" && lead.data.telephone ? ["telephone"] : []),
  ];
  if (!lead.data.email && !lead.data.telephone) return { ...prev, error: "Indiquez un e-mail ou un téléphone pour être recontacté." };
  if (!channels.length) return { ...prev, error: "Cochez la case qui correspond à votre e-mail ou à votre téléphone pour accepter d'être recontacté." };

  // L'adresse et l'estimation sont recalculées : rien de ce qui vient du navigateur n'est repris tel quel.
  const address = await findAddress(prev.address);
  if (!address) return { step: "saisie", error: "Adresse introuvable : recommencez l'estimation." };
  const estimate = await publicEstimate(address, prev.type, prev.surface, prev.rooms);
  const h = await headers();
  try {
    await getTenantPool().query(
      `SELECT app.capture_public_lead($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        page.orgId, ipHash(h.get("x-forwarded-for"), h.get("x-real-ip")),
        lead.data.prenom, lead.data.nom, lead.data.email ? normalizeEmail(lead.data.email) : "", lead.data.telephone, channels,
        address.label, address.banId, address.inseeCode, address.longitude, address.latitude,
        prev.type, prev.surface, prev.rooms, estimate?.low ?? null, estimate?.high ?? null,
      ],
    );
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P0003") return { ...prev, error: "Trop de demandes depuis cette connexion. Réessayez dans une heure." };
    if (code === "P0002") return { step: "saisie", error: "Cette page d'estimation n'est plus disponible." };
    throw e;
  }
  return { step: "envoye", agency: page.name };
}
