/**
 * Provenance d'une donnée (exigence centrale : docs/phase-2/modele-donnees.md, section 2).
 * Chaque bloc du dossier affiche son statut et sa source datée.
 */
import type { DataStatus, SourceRef } from "@/lib/dossier/types";
import { fmt } from "@/lib/format";
import { Badge } from "./surface";

const STATUS: Record<DataStatus, { label: string; tone: "success" | "brand" | "warning" | "neutral" | "danger"; help: string }> = {
  verifiee: { label: "Vérifiée", tone: "success", help: "Issue d'une source officielle, identifiée et datée." },
  declaree: { label: "Déclarée", tone: "neutral", help: "Saisie par l'utilisateur, non vérifiée." },
  estimee: { label: "Estimée", tone: "brand", help: "Calculée par une méthode documentée, avec un intervalle." },
  hypothese: { label: "Hypothèse", tone: "warning", help: "Paramètre choisi, modifiable." },
  manquante: { label: "Manquante", tone: "danger", help: "Donnée introuvable : rien n'a été inventé." },
};

export function StatusBadge({ status }: { status: DataStatus }) {
  const s = STATUS[status];
  return (
    <span title={s.help}>
      <Badge tone={s.tone}>{s.label}</Badge>
    </span>
  );
}

export function SourceLine({ source }: { source: SourceRef }) {
  const asOf = source.asOf ? (/^\d{4}$/.test(source.asOf) ? `millésime ${source.asOf}` : `données au ${fmt.date(source.asOf)}`) : null;
  return (
    <p className="text-xs text-ink-muted">
      Source : {source.citation}
      {asOf ? ` · ${asOf}` : null}
      {source.url ? (
        <>
          {" · "}
          <a href={source.url} target="_blank" rel="noreferrer" className="font-medium text-brand-text hover:underline print:hidden">
            rapport officiel
          </a>
        </>
      ) : null}
    </p>
  );
}

export function MissingNote({ note }: { note?: string }) {
  return <p className="text-sm text-ink-muted">{note ?? "Donnée manquante."}</p>;
}
