"use client";
/**
 * Import CSV en deux temps : 1) aperçu ligne par ligne (rien n'est écrit) ; 2) confirmation.
 * Le serveur relit et revérifie tout à la confirmation.
 */
import Link from "next/link";
import { useActionState } from "react";
import type { ImportState } from "@/lib/crm/import-actions";
import { VISIBILITY } from "@/lib/crm/labels";
import { buttonClass } from "@/ui/button";
import { SubmitButton } from "@/ui/client";
import { Field, Input, Select } from "@/ui/form";
import { Alert, Badge } from "@/ui/surface";
import type { Member } from "./parts";

type Action = (prev: ImportState, form: FormData) => Promise<ImportState>;

const STATUS = {
  ok: { label: "À importer", tone: "success" },
  doublon: { label: "Doublon, ignoré", tone: "warning" },
  erreur: { label: "Erreur, ignorée", tone: "danger" },
} as const;

export function ImportWizard({
  previewAction,
  importAction,
  noun,
  template,
  templateName,
  backHref,
  members,
  canAssign,
  meId,
  defaultVisibility,
  notice,
}: {
  previewAction: Action;
  importAction: Action;
  noun: string;
  template: string;
  templateName: string;
  backHref: string;
  members: Member[];
  canAssign: boolean;
  meId: string;
  defaultVisibility: "private" | "agency";
  notice?: string;
}) {
  const [preview, runPreview] = useActionState(previewAction, {});
  const [result, runImport] = useActionState(importAction, {});
  const p = preview.preview;

  if (result.success) {
    return (
      <div className="space-y-3 px-5 py-5">
        <Alert tone="success">{result.success}</Alert>
        <Link href={backHref} className={buttonClass("primary")}>
          Voir les {noun}
        </Link>
      </div>
    );
  }

  return (
    <div className="divide-y divide-line">
      <form action={runPreview} className="space-y-4 px-5 py-5">
        <p className="text-sm text-ink-muted">
          Fichier CSV (séparateur point-virgule ou virgule, export Excel accepté), 1 Mo au maximum. La première ligne doit contenir les noms de colonnes.{" "}
          <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`} download={templateName} className="font-medium text-brand-text underline">
            Télécharger un modèle
          </a>
          .
        </p>
        {notice ? <Alert tone="warning">{notice}</Alert> : null}
        {preview.error ? <Alert tone="danger">{preview.error}</Alert> : null}
        <Field label="Fichier CSV" htmlFor="file">
          <Input id="file" name="file" type="file" accept=".csv,text/csv" required className="py-1.5" />
        </Field>
        <SubmitButton variant="secondary" pendingLabel="Lecture et vérification…">
          Vérifier le fichier
        </SubmitButton>
      </form>

      {p ? (
        <div className="space-y-4 px-5 py-5">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="success">{p.counts.ok} à importer</Badge>
            <Badge tone="warning">{p.counts.doublon} doublon(s)</Badge>
            <Badge tone="danger">{p.counts.erreur} erreur(s)</Badge>
          </div>
          <p className="text-xs text-ink-muted">
            Colonnes reconnues : {p.recognized.join(", ") || "aucune"}.
            {p.unknownColumns.length ? ` Colonnes ignorées : ${p.unknownColumns.join(", ")}.` : ""}
            {p.encoding === "windows-1252" ? " Encodage Windows (Excel) détecté et converti." : ""}
          </p>
          {"quotaWarning" in p && p.quotaWarning ? <Alert tone="warning">{p.quotaWarning}</Alert> : null}
          <div role="region" aria-label="Aperçu de l'import (défilable)" tabIndex={0} className="max-h-96 overflow-auto rounded-[var(--radius-control)] border border-line">
            <table className="w-full text-sm">
              <caption className="sr-only">Aperçu de l&apos;import, ligne par ligne</caption>
              <thead className="sticky top-0 bg-surface-muted text-left text-xs text-ink-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Ligne</th>
                  <th scope="col" className="px-3 py-2 font-medium">Élément</th>
                  <th scope="col" className="px-3 py-2 font-medium">Résultat</th>
                  <th scope="col" className="px-3 py-2 font-medium">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {p.rows.map((r) => (
                  <tr key={r.line}>
                    <td className="tabular px-3 py-2 text-ink-muted">{r.line}</td>
                    <td className="px-3 py-2 text-ink">{r.label}</td>
                    <td className="px-3 py-2"><Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge></td>
                    <td className="px-3 py-2 text-[13px] text-ink-muted">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {p.counts.ok > 0 ? (
            <form action={runImport} className="space-y-4">
              {result.error ? <Alert tone="danger">{result.error}</Alert> : null}
              <input type="hidden" name="csv" value={preview.csv ?? ""} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Visibilité des éléments importés" htmlFor="visibility">
                  <Select id="visibility" name="visibility" defaultValue={defaultVisibility}>
                    <option value="agency">{VISIBILITY.agency}</option>
                    <option value="private">{VISIBILITY.private}</option>
                  </Select>
                </Field>
                {canAssign ? (
                  <Field label="Responsable" htmlFor="ownerUserId">
                    <Select id="ownerUserId" name="ownerUserId" defaultValue={meId}>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>{m.name}</option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <input type="hidden" name="ownerUserId" value={meId} />
                )}
              </div>
              <SubmitButton pendingLabel="Import en cours…">
                Importer {p.counts.ok} {noun}
              </SubmitButton>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
