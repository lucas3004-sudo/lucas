/**
 * Assistant IA (D-063) : une conversation pour se faire aider sur ImmoPilot et interroger les
 * données de l'agence, puis le guide « Comment faire… », utile même quand l'IA est éteinte.
 */
import { AI_GATE_MESSAGES } from "@immopilot/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/agency/context";
import { assistantGate } from "@/lib/ai/assistant";
import { GUIDE } from "@/lib/ai/guide";
import { Alert, Card, CardHeader, PageHeader } from "@/ui/surface";
import { AssistantChat } from "./chat";

export const metadata: Metadata = { title: "Assistant IA" };

export default async function AssistantPage() {
  const ctx = await requireAgency();
  const gate = await assistantGate(ctx);
  return (
    <>
      <PageHeader
        title={
          <>
            Assistant <span className="font-serif text-[1.12em] font-normal italic tracking-normal text-brand-text">IA</span>
          </>
        }
        description="Une question sur ImmoPilot ou sur les biens de l'agence ? Demandez. L'assistant ne voit que ce que vous voyez, jamais les coordonnées des contacts."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          {gate ? <Alert tone={gate === "desactivee" ? "brand" : "warning"}>{AI_GATE_MESSAGES[gate]}</Alert> : null}
          <AssistantChat disabled={gate !== null} />
          <p className="text-xs text-ink-muted">
            Réponses générées par une IA (Claude, d&apos;Anthropic) : elles peuvent contenir des erreurs. Chaque échange compte dans le quota mensuel de l&apos;agence
            (<Link href="/app/formule" className="underline">voir la consommation</Link>).
          </p>
        </div>
        <Card>
          <CardHeader title="Comment faire…" description="Les gestes les plus courants, en une phrase." />
          <ul className="divide-y divide-line">
            {GUIDE.map((g) => (
              <li key={g.question}>
                <details className="group px-5 py-3">
                  <summary className="cursor-pointer list-none text-sm font-medium text-ink marker:hidden">
                    <span className="mr-2 inline-block text-ink-muted transition-transform duration-200 group-open:rotate-90" aria-hidden>›</span>
                    <span>{g.question}</span>
                  </summary>
                  <p className="mt-2 pl-4 text-sm leading-relaxed text-ink-muted">
                    {g.answer}{" "}
                    {g.href ? <Link href={g.href} className="font-medium text-brand-text underline">Y aller</Link> : null}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
