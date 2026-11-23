/**
 * Rejoué à chaque changement de page : le contenu entre en une vague courte (D-059).
 * Les animations sont dans globals.css (.page-in) et coupées si les mouvements sont réduits.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
