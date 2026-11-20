/** Libellés et listes fermées du CRM (identiques aux contraintes CHECK de la migration 0007). */
export const CONTACT_ROLES = {
  acquereur: "Acquéreur",
  vendeur: "Vendeur",
  investisseur: "Investisseur",
  bailleur: "Bailleur",
  locataire: "Locataire",
  autre: "Autre",
} as const;
export type ContactRole = keyof typeof CONTACT_ROLES;

export const PROPERTY_STATUS = {
  prospect: "Prospect",
  mandat: "Sous mandat",
  sous_offre: "Sous offre",
  vendu: "Vendu",
  retire: "Retiré",
} as const;
export type PropertyStatus = keyof typeof PROPERTY_STATUS;

export const PROFILE_STATUS = { actif: "Actif", en_pause: "En pause", clos: "Clos" } as const;
export type ProfileStatus = keyof typeof PROFILE_STATUS;

export const CONSENT_CHANNELS = { telephone: "Téléphone", email: "E-mail", sms: "SMS" } as const;
export type ConsentChannel = keyof typeof CONSENT_CHANNELS;

export const VISIBILITY = {
  agency: "Partagé avec l'agence",
  private: "Privé",
} as const;

export const MATCHABLE_STATUSES: PropertyStatus[] = ["prospect", "mandat", "sous_offre"];
