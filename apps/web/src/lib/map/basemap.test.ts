import { describe, expect, it } from "vitest";
import { BASEMAP_COLORS as C, cleanBasemap } from "./basemap";

const style = {
  version: 8,
  sources: {},
  layers: [
    { id: "fond", type: "background", paint: { "background-color": "#fff" } },
    { id: "Bâti", type: "fill", "source-layer": "bati_surf", paint: { "fill-color": "#ccc", "fill-pattern": "hachures" } },
    { id: "Routier a niveau - filet extérieur - route locale", type: "line", "source-layer": "routier_route", paint: { "line-color": "#8C8C8C", "line-width": 3 } },
    { id: "Routier a niveau - filet interieur - autoroute", type: "line", "source-layer": "routier_route", paint: { "line-color": "#F18800" } },
    { id: "Sigle école", type: "symbol", "source-layer": "toponyme_bati_ponc", layout: { "text-field": "Éc." } },
    { id: "Nom de rue", type: "symbol", "source-layer": "toponyme_routier_odonyme_lin", paint: { "text-color": "#000" } },
    { id: "Courbes", type: "line", "source-layer": "oro_courbe", paint: {} },
    { id: "Point", type: "circle", "source-layer": "bati_ponc", paint: {} },
  ],
};

describe("fond de carte épuré (style IGN retouché)", () => {
  const out = cleanBasemap(style);
  const byId = Object.fromEntries(out.layers.map((l) => [l.id, l]));
  it("couleurs douces, routes blanches à liseré, autoroutes jaune pâle, motifs retirés", () => {
    expect(byId["fond"]!.paint).toEqual({ "background-color": C.fond });
    expect(byId["Bâti"]!.paint).toEqual({ "fill-color": C.bati, "fill-outline-color": C.bati });
    expect(byId["Routier a niveau - filet extérieur - route locale"]!.paint).toEqual({ "line-color": C.routeLisere, "line-width": 3 });
    expect(byId["Routier a niveau - filet interieur - autoroute"]!.paint).toEqual({ "line-color": C.autoroute });
  });
  it("sigles, relief et pictogrammes masqués ; noms de rues gardés", () => {
    expect(byId["Sigle école"]!.layout).toMatchObject({ visibility: "none" });
    expect(byId["Courbes"]!.layout).toMatchObject({ visibility: "none" });
    expect(byId["Point"]!.layout).toMatchObject({ visibility: "none" });
    expect((byId["Nom de rue"]!.layout as Record<string, unknown> | undefined)?.visibility).toBeUndefined();
    expect(byId["Nom de rue"]!.paint).toMatchObject({ "text-color": C.texte, "text-halo-color": "#ffffff" });
  });
  it("ne modifie pas le style d'origine", () => {
    expect(style.layers[1]!.paint).toEqual({ "fill-color": "#ccc", "fill-pattern": "hachures" });
  });
});
