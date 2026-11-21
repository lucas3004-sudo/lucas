/** Types de rendez-vous (identiques à la contrainte CHECK de la migration 0009). */
export const APPOINTMENT_KINDS = {
  visite: "Visite",
  estimation: "Estimation",
  signature: "Signature",
  rendez_vous: "Rendez-vous",
  autre: "Autre",
} as const;
export type AppointmentKind = keyof typeof APPOINTMENT_KINDS;

export const DURATIONS_MIN = [30, 45, 60, 90, 120, 180] as const;
