const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" });
const month = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "Europe/Paris" });

export const fmt = {
  euros: (v: number) => euros.format(v),
  number: (v: number) => number.format(v),
  decimal: (v: number) => decimal.format(v),
  perSqm: (v: number) => `${number.format(Math.round(v))} €/m²`,
  date: (iso: string | Date) => day.format(typeof iso === "string" ? new Date(`${iso.slice(0, 10)}T12:00:00Z`) : iso),
  month: (iso: string) => month.format(new Date(`${iso.slice(0, 10)}T12:00:00Z`)),
  distance: (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`),
};
