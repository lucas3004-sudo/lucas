"use client";
/** Changement du statut de prospection ; la date de relance n'apparaît que pour « Relance à effectuer ». */
import { PROSPECTION_LABELS, PROSPECTION_STATUSES, type ProspectionStatus } from "@immopilot/domain";
import { useState } from "react";
import { setProspectionStatusAction } from "@/lib/crm/prospection-actions";
import { SubmitButton } from "@/ui/client";
import { Input, Select } from "@/ui/form";

export function ProspectionStatusForm({
  id,
  status,
  today,
  defaultFollowUpOn,
  label,
}: {
  id: string;
  status: ProspectionStatus;
  today: string;
  defaultFollowUpOn: string;
  /** Adresse du bien : donne un nom distinct aux champs quand la liste en compte plusieurs. */
  label: string;
}) {
  // Champs contrôlés : React vide les champs libres d'un formulaire après chaque envoi.
  const [value, setValue] = useState<ProspectionStatus>(status);
  const [date, setDate] = useState(defaultFollowUpOn);
  return (
    <form action={setProspectionStatusAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="space-y-1 text-[13px] text-ink">
        <span className="block font-medium">Statut</span>
        <Select
          name="status"
          value={value}
          onChange={(e) => setValue(e.target.value as ProspectionStatus)}
          aria-label={`Statut de prospection : ${label}`}
          className="h-9 w-auto"
        >
          {PROSPECTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROSPECTION_LABELS[s]}
            </option>
          ))}
        </Select>
      </label>
      {value === "relance" ? (
        <label className="space-y-1 text-[13px] text-ink">
          <span className="block font-medium">Relancer le</span>
          <Input type="date" name="followUpOn" min={today} value={date} onChange={(e) => setDate(e.target.value)} aria-label={`Date de relance : ${label}`} className="h-9 w-auto" />
        </label>
      ) : null}
      <SubmitButton size="sm" variant="secondary" aria-label={`Mettre à jour le statut : ${label}`}>
        Mettre à jour
      </SubmitButton>
    </form>
  );
}
