/** Éléments d'affichage partagés par les écrans du CRM (sans état : utilisables côté serveur). */
import { CRITERION_LABELS, PROPERTY_FEATURES, type MatchResult, type PropertyFeature, type Satisfaction } from "@immopilot/domain";
import type { AgencyContext } from "@/lib/agency/context";
import { PROPERTY_STATUS, type PropertyStatus } from "@/lib/crm/labels";
import { Check } from "@/ui/form";
import { Badge } from "@/ui/surface";

export type Member = { userId: string; name: string };

/** Peut modifier un contact ou un bien (mêmes règles que la politique RLS « update »). */
export function canEditRecord(ctx: AgencyContext, ownerUserId: string): boolean {
  return ownerUserId === ctx.user.id || ctx.role === "gerant" || ctx.role === "manager" || ctx.role === "assistant";
}

export function canDeleteRecord(ctx: AgencyContext): boolean {
  return ctx.role === "gerant" || ctx.role === "manager";
}

export function canAssignOwner(ctx: AgencyContext): boolean {
  return ctx.role === "gerant" || ctx.role === "manager" || ctx.role === "assistant";
}

export function memberName(members: Member[], userId: string): string {
  return members.find((m) => m.userId === userId)?.name ?? "Ancien membre";
}

export function FeatureChecks({ name = "features", defaultValue = [] }: { name?: string; defaultValue?: readonly PropertyFeature[] }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-medium text-ink">Équipements</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {(Object.entries(PROPERTY_FEATURES) as [PropertyFeature, string][]).map(([key, label]) => (
          <Check key={key} name={name} value={key} label={label} defaultChecked={defaultValue.includes(key)} />
        ))}
      </div>
    </fieldset>
  );
}

export function FeatureList({ features }: { features: readonly PropertyFeature[] }) {
  if (!features.length) return <span className="text-ink-muted">Aucun renseigné</span>;
  return <>{features.map((f) => PROPERTY_FEATURES[f]).join(", ")}</>;
}

const STATUS_TONE: Record<PropertyStatus, "brand" | "success" | "warning" | "neutral"> = {
  prospect: "neutral",
  mandat: "brand",
  sous_offre: "warning",
  vendu: "success",
  retire: "neutral",
};

export function PropertyStatusBadge({ status }: { status: PropertyStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{PROPERTY_STATUS[status]}</Badge>;
}

export function VisibilityBadge({ visibility }: { visibility: "private" | "agency" }) {
  return visibility === "private" ? <Badge>Privé</Badge> : null;
}

export function scoreTone(score: number): "success" | "brand" | "warning" {
  return score >= 75 ? "success" : score >= 50 ? "brand" : "warning";
}

const SATISFACTION: Record<Satisfaction, { label: string; className: string }> = {
  oui: { label: "Rempli", className: "text-success" },
  partiel: { label: "Partiel", className: "text-warning" },
  non: { label: "Non rempli", className: "text-danger" },
  inconnu: { label: "À vérifier", className: "text-ink-muted" },
};

/** Explication critère par critère d'un rapprochement (aucun score sans justification). */
export function MatchExplanation({ result }: { result: Extract<MatchResult, { compatible: true }> }) {
  return (
    <ul className="mt-2 grid gap-1 text-[13px] sm:grid-cols-2">
      {result.criteria.map((c) => (
        <li key={c.key} className="flex gap-2">
          <span className={`w-24 shrink-0 font-medium ${SATISFACTION[c.satisfaction].className}`}>{SATISFACTION[c.satisfaction].label}</span>
          <span className="text-ink-muted">
            <span className="text-ink">{CRITERION_LABELS[c.key]}</span> — {c.detail}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children ? <p className="mt-1 text-sm text-ink-muted">{children}</p> : null}
    </div>
  );
}
