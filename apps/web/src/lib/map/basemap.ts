/**
 * Fond de carte « épuré » à partir du style vectoriel officiel PLAN IGN (standard) : couleurs
 * douces, routes blanches à fin liseré, eau bleu clair, végétation vert pâle ; sigles d'équipements
 * (« Éc. », « Admin. »…), relief, parcelles et limites masqués ; seuls les noms de rues, de lieux
 * et de cours d'eau restent. Fonction pure (testée) : on ne modifie que la présentation.
 */

type Layer = {
  id: string;
  type: string;
  "source-layer"?: string;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
};
export type BaseStyle = { layers: Layer[] } & Record<string, unknown>;

export const BASEMAP_COLORS = {
  fond: "#f4f3ef",
  eau: "#b9d7ee",
  vegetation: "#d9e9cf",
  sol: "#ecebe4",
  bati: "#e4e1dc",
  batiContour: "#d8d4ce",
  zone: "#eeece7",
  route: "#ffffff",
  routeLisere: "#d6d3cd",
  autoroute: "#f8dc9b",
  autorouteLisere: "#e5c27a",
  rail: "#c7c3bd",
  texte: "#5c5f66",
  texteLieu: "#3c4048",
} as const;

const HIDDEN_SOURCES = new Set([
  "oro_relief", "oro_courbe", "oro_lin", "oro_ponc", "parcellaire_parcelle", "parcellaire_section",
  "bati_lin", "limite_lin", "bati_ponc", "routier_ponc", "hydro_ponc",
]);
const KEPT_LABELS = new Set(["toponyme_routier_odonyme_lin", "toponyme_localite_ponc", "toponyme_hydro_lin", "toponyme_hydro_ponc"]);

function hide(layer: Layer): Layer {
  return { ...layer, layout: { ...layer.layout, visibility: "none" } };
}

export function cleanBasemap<S extends BaseStyle>(style: S): S {
  const C = BASEMAP_COLORS;
  const layers = style.layers.map((layer): Layer => {
    const sl = layer["source-layer"] ?? "";
    const id = layer.id.toLowerCase();
    if (layer.type === "background") return { ...layer, paint: { "background-color": C.fond } };
    if (layer.type === "circle" || HIDDEN_SOURCES.has(sl)) return hide(layer);
    if (layer.type === "symbol") {
      if (!KEPT_LABELS.has(sl)) return hide(layer);
      return {
        ...layer,
        paint: { ...layer.paint, "text-color": sl === "toponyme_localite_ponc" ? C.texteLieu : C.texte, "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
      };
    }
    const paint = { ...layer.paint };
    delete paint["fill-pattern"];
    const color = (c: string) => (layer.type === "fill" ? { "fill-color": c, "fill-outline-color": c } : { "line-color": c });
    if (sl === "fond_opaque") return { ...layer, paint: { ...paint, ...color(C.fond) } };
    if (sl.startsWith("hydro")) return { ...layer, paint: { ...paint, ...color(C.eau) } };
    if (sl === "ocs_vegetation_surf") return { ...layer, paint: { ...paint, ...color(C.vegetation) } };
    if (sl === "ocs_nature_sol_surf") return { ...layer, paint: { ...paint, ...color(C.sol) } };
    if (sl === "bati_surf") return { ...layer, paint: { ...paint, ...color(layer.type === "line" ? C.batiContour : C.bati) } };
    if (sl === "bati_zai" || sl === "bati_zone_surf") return { ...layer, paint: { ...paint, ...color(C.zone) } };
    if (sl === "routier_surf") return { ...layer, paint: { ...paint, ...color(C.route) } };
    if (sl.startsWith("ferre")) return { ...layer, paint: { ...paint, ...color(C.rail) } };
    if (sl.startsWith("routier")) {
      const major = id.includes("autoroute") || id.includes("bretelle");
      const casing = id.includes("extérieur") || id.includes("exterieur");
      return { ...layer, paint: { ...paint, ...color(major ? (casing ? C.autorouteLisere : C.autoroute) : casing ? C.routeLisere : C.route) } };
    }
    return layer;
  });
  return { ...style, layers };
}
