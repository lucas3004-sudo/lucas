/** Étapes d'une affaire et pièces indicatives par étape (identiques à la migration 0010). */
export const DEAL_STAGES = {
  offre: "Offre acceptée",
  compromis: "Compromis signé",
  conditions_levees: "Conditions levées",
  acte: "Acte signé",
  abandon: "Abandonnée",
} as const;
export type DealStage = keyof typeof DEAL_STAGES;

/** Ordre de progression (l'abandon est à part). */
export const STAGE_FLOW: DealStage[] = ["offre", "compromis", "conditions_levees", "acte"];
export const ACTIVE_STAGES: DealStage[] = ["offre", "compromis", "conditions_levees"];

/** Liste INDICATIVE des pièces, à adapter avec le notaire (aucune valeur juridique). */
export const CHECKLIST: Record<Exclude<DealStage, "abandon">, Array<{ key: string; label: string }>> = {
  offre: [
    { key: "offre_ecrite", label: "Offre d'achat écrite et signée" },
    { key: "justificatif_financement", label: "Justificatif de financement (accord de principe, attestation d'apport)" },
    { key: "identite_parties", label: "Pièces d'identité et état civil des parties" },
  ],
  compromis: [
    { key: "titre_propriete", label: "Titre de propriété du vendeur" },
    { key: "ddt", label: "Dossier de diagnostics techniques (DPE, amiante, plomb, électricité, gaz…)" },
    { key: "erp", label: "État des risques (ERP) de moins de 6 mois" },
    { key: "pieces_copro", label: "Copropriété : règlement, PV d'AG des 3 dernières années, fiche synthétique, pré-état daté" },
    { key: "surface", label: "Mesurage de la surface (loi Carrez en copropriété)" },
    { key: "notification_sru", label: "Notification du compromis à l'acquéreur (point de départ de la rétractation)" },
  ],
  conditions_levees: [
    { key: "offre_pret", label: "Offre de prêt de l'acquéreur" },
    { key: "preemption", label: "Purge du droit de préemption urbain (réponse à la DIA)" },
    { key: "autres_conditions", label: "Levée des autres conditions suspensives" },
  ],
  acte: [
    { key: "fonds_notaire", label: "Fonds de l'acquéreur reçus par le notaire" },
    { key: "releve_compteurs", label: "Relevé des compteurs à la remise des clés" },
    { key: "assurance_acquereur", label: "Attestation d'assurance habitation de l'acquéreur" },
  ],
};

export const CHECKLIST_KEYS = new Set(Object.values(CHECKLIST).flat().map((i) => i.key));
