"use server";
/**
 * Envoi d'une question à l'assistant IA (D-063). L'historique vient du navigateur : il est
 * vérifié et limité (taille, nombre d'échanges) pour borner le coût de chaque appel.
 */
import { z } from "zod";
import { requireAgency } from "../agency/context";
import { askAssistant, type ChatTurn } from "./assistant";

export interface ChatState {
  turns: ChatTurn[];
  error?: string;
}

const historySchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
  .max(20);
const questionSchema = z.string().trim().min(2, "Écrivez votre question.").max(2000, "Question trop longue (2 000 caractères au plus).");

export async function askAssistantAction(prev: ChatState, form: FormData): Promise<ChatState> {
  const ctx = await requireAgency();
  let history: ChatTurn[] = prev.turns;
  try {
    history = historySchema.parse(JSON.parse(String(form.get("history") ?? "[]")));
  } catch {
    history = [];
  }
  const question = questionSchema.safeParse(form.get("question"));
  if (!question.success) return { turns: history, error: question.error.issues[0]?.message ?? "Question invalide." };
  const result = await askAssistant(ctx, history, question.data);
  if (!result.ok) return { turns: history, error: result.message };
  const turns: ChatTurn[] = [...history, { role: "user", text: question.data }, { role: "assistant", text: result.answer }];
  return { turns: turns.slice(-20) };
}
