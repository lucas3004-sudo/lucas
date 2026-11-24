"use server";
/**
 * Récap rédigé par l'IA (D-069) : quelques phrases à partir des chiffres du récap, tels que
 * l'utilisateur les voit (RLS). Seuls des nombres et des libellés partent, aucun nom ni adresse.
 */
import { RECAP_PERIOD_LABELS, recapLines, type RecapPeriod } from "@immopilot/domain";
import { requireAgency } from "../agency/context";
import { RECAP_SYSTEM } from "../ai/agent-prompts";
import { aiText } from "../ai/run";
import { recapData } from "./data";

export interface AiRecapState {
  text?: string;
  error?: string;
}

export async function aiRecapAction(_prev: AiRecapState, form: FormData): Promise<AiRecapState> {
  const ctx = await requireAgency();
  const period: RecapPeriod = form.get("period") === "semaine" ? "semaine" : "jour";
  const { counts, priceDrops } = await recapData(ctx, period);
  const lines = recapLines(counts).map((l) => `- ${l.text}`);
  if (priceDrops.length) lines.push(`- ${priceDrops.length} baisse(s) de prix`);
  const r = await aiText(ctx, {
    feature: "copilot",
    system: RECAP_SYSTEM,
    prompt: `Période : ${RECAP_PERIOD_LABELS[period]}.\nChiffres de l'agence :\n${lines.join("\n") || "- aucune activité"}`,
    maxTokens: 400,
  });
  return r.ok ? { text: r.text.slice(0, 1200) } : { error: r.message };
}
