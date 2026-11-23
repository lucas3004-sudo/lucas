"use client";
/**
 * Carte des biens (MapLibre GL, fond vectoriel IGN « gris » et vue satellite IGN, sans clé).
 * Biens regroupés quand on dézoome, étiquettes de prix, ventes réelles autour, recherche de lieu
 * et rayon, cartes à photo à côté de la carte. Popups construits avec des nœuds DOM (textContent) :
 * aucune donnée saisie ne peut s'exécuter. La liste est l'alternative accessible à la carte.
 */
import "maplibre-gl/dist/maplibre-gl.css";
import { marketPositionLabel, PROPERTY_FEATURES } from "@immopilot/domain";
import type { GeoJSONSource, Map as MlMap, MapGeoJSONFeature, Popup } from "maplibre-gl";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PROPERTY_STATUS } from "@/lib/crm/labels";
import type { MapProperty, MapSale } from "@/lib/map/data";
import { cleanBasemap, type BaseStyle } from "@/lib/map/basemap";
import { applyFilters, circlePolygon, DPE_ORDER, shortPrice, type MapFilters, type SortKey } from "@/lib/map/filters";
import { cn } from "@/ui/cn";
import { Badge } from "@/ui/surface";
import { PlaceSearch, type Place } from "./place-search";

const STYLE_URL = "https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/standard.json";
const ORTHO_TILES =
  "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal" +
  "&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg";
const SALES_MIN_ZOOM = 13;
const COLORS = { sous_marche: "#0f7258", dans_marche: "#1d4380", au_dessus: "#b45309", inconnu: "#626b7e", vente: "#7c3aed", marque: "#1c1411" } as const;
const RADII = [null, 0.5, 1, 2, 5, 10, 20] as const;

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const dateFr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const photoUrl = (id: string) => `/api/v1/photos/${id}`;
const sheetUrl = (id: string) => `/app/proprietes/${id}/fiche`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function propertyPopup(p: MapProperty): HTMLElement {
  const root = el("div", "w-60 font-sans");
  if (p.photoId) {
    const img = el("img", "mb-2 h-32 w-full rounded-md object-cover");
    img.src = photoUrl(p.photoId);
    img.alt = "";
    root.append(img);
  }
  root.append(el("p", "text-base font-semibold text-[#111827]", p.price ? euros.format(p.price) : "Prix non renseigné"));
  root.append(el("p", "text-xs text-[#556074]", `${p.type}${p.surface ? ` · ${num.format(p.surface)} m²` : ""}${p.rooms ? ` · ${p.rooms} pièces` : ""}`));
  root.append(el("p", "mt-0.5 truncate text-xs text-[#556074]", p.label));
  root.append(el("p", "mt-1 text-xs font-medium text-[#111827]", marketPositionLabel(p.position)));
  const link = el("a", "mt-2 inline-block rounded-md bg-[#1c1411] px-3 py-1.5 text-xs font-medium text-white", "Voir la fiche");
  link.href = sheetUrl(p.id);
  root.append(link);
  return root;
}

function salePopup(s: MapSale): HTMLElement {
  const root = el("div", "font-sans text-xs text-[#111827]");
  root.append(el("p", "text-sm font-semibold", `Vendu ${euros.format(s.price)}`));
  root.append(el("p", "", `${s.type} · ${num.format(s.surface)} m² · ${num.format(s.pricePerSqm)} €/m²`));
  root.append(el("p", "text-[#556074]", `Le ${dateFr(s.date)} · DVF, adresse non affichée`));
  return root;
}

type SourceData = Parameters<GeoJSONSource["setData"]>[0];

const toGeoJson = (list: MapProperty[]): SourceData => ({
  type: "FeatureCollection",
  features: list.map((p) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [p.lon, p.lat] },
    properties: { id: p.id, prix: shortPrice(p.price), couleur: COLORS[p.position.kind] },
  })),
});

const initialFilters: MapFilters = {
  type: "tous", statuses: new Set(["mandat", "sous_offre"]), minPrice: null, maxPrice: null, minSurface: null, maxSurface: null,
  minRooms: null, maxPricePerSqm: null, worstDpe: null, features: new Set(), dealsOnly: false, mineOnly: false, withPhotos: false,
  place: null, radiusKm: null, sort: "affaires",
};

export function MapView({ properties }: { properties: MapProperty[] }) {
  const [filters, setFilters] = useState<MapFilters>(initialFilters);
  const [place, setPlace] = useState<Place | null>(null);
  const [showSales, setShowSales] = useState(true);
  const [satellite, setSatellite] = useState(false);
  const [salesInfo, setSalesInfo] = useState("");
  const [mapState, setMapState] = useState<"chargement" | "prete" | "indisponible">("chargement");
  const [hovered, setHovered] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const showSalesRef = useRef(showSales);
  const byId = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  const visible = useMemo(
    () => applyFilters(properties, { ...filters, place: place ? { lon: place.lon, lat: place.lat } : null }),
    [properties, filters, place],
  );

  function openPopup(p: MapProperty) {
    const lib = libRef.current;
    const map = mapRef.current;
    if (!lib || !map) return;
    popupRef.current?.remove();
    popupRef.current = new lib.Popup({ offset: 16, maxWidth: "260px" }).setLngLat([p.lon, p.lat]).setDOMContent(propertyPopup(p)).addTo(map);
  }

  // Création de la carte (une fois).
  useEffect(() => {
    let cancelled = false;
    // Style officiel PLAN IGN, retouché pour un rendu épuré (lib/map/basemap.ts).
    void Promise.all([import("maplibre-gl"), fetch(STYLE_URL).then((r) => r.json() as Promise<BaseStyle>)])
      .then(([lib, baseStyle]) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        libRef.current = lib;
        let map: MlMap;
        try {
          map = new lib.Map({
            container: containerRef.current,
            style: cleanBasemap(baseStyle) as unknown as import("maplibre-gl").StyleSpecification,
            center: [2.4, 46.6],
            zoom: 5,
            maxZoom: 19,
            attributionControl: { compact: true, customAttribution: "© IGN – Géoplateforme · DVF (DGFiP)" },
            locale: {
              "NavigationControl.ZoomIn": "Zoomer",
              "NavigationControl.ZoomOut": "Dézoomer",
              "NavigationControl.ResetBearing": "Réorienter vers le nord",
              "FullscreenControl.Enter": "Plein écran",
              "FullscreenControl.Exit": "Quitter le plein écran",
              "AttributionControl.ToggleAttribution": "Sources de la carte",
              "Popup.Close": "Fermer",
            },
          });
        } catch {
          setMapState("indisponible");
          return;
        }
        mapRef.current = map;
        map.addControl(new lib.NavigationControl({ visualizePitch: false }), "top-right");
        map.addControl(new lib.FullscreenControl(), "top-right");
        map.addControl(new lib.ScaleControl({ unit: "metric" }), "bottom-left");
        map.getCanvas().setAttribute("aria-label", "Carte des biens de l'agence et des ventes réelles");

        // « style.load » : le style est prêt (sources et calques ajoutables) sans attendre toutes les tuiles du fond.
        map.once("style.load", () => {
          map.addSource("ortho", { type: "raster", tiles: [ORTHO_TILES], tileSize: 256, maxzoom: 19, attribution: "© IGN" });
          map.addLayer({ id: "ortho", type: "raster", source: "ortho", layout: { visibility: "none" } });
          map.addSource("rayon", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "rayon-fond", type: "fill", source: "rayon", paint: { "fill-color": COLORS.marque, "fill-opacity": 0.07 } });
          map.addLayer({ id: "rayon-bord", type: "line", source: "rayon", paint: { "line-color": COLORS.marque, "line-width": 1.5, "line-dasharray": [2, 2] } });
          map.addSource("ventes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({
            id: "ventes-points", type: "circle", source: "ventes",
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 2.5, 17, 5], "circle-color": COLORS.vente,
              "circle-opacity": 0.35,
            },
          });
          map.addSource("biens", { type: "geojson", data: toGeoJson([]), cluster: true, clusterMaxZoom: 14, clusterRadius: 48, promoteId: "id" });
          map.addLayer({
            id: "biens-groupes", type: "circle", source: "biens", filter: ["has", "point_count"],
            paint: {
              "circle-color": COLORS.marque, "circle-opacity": 0.92, "circle-stroke-width": 3, "circle-stroke-color": "#ffffff",
              "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26],
            },
          });
          map.addLayer({
            id: "biens-groupes-nombre", type: "symbol", source: "biens", filter: ["has", "point_count"],
            layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Source Sans Pro Bold"], "text-size": 13 },
            paint: { "text-color": "#ffffff" },
          });
          map.addLayer({
            id: "biens-points", type: "circle", source: "biens", filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": ["get", "couleur"], "circle-stroke-width": 2.5, "circle-stroke-color": "#ffffff",
              "circle-radius": ["case", ["boolean", ["feature-state", "survol"], false], 13, 10],
            },
          });
          map.addLayer({
            id: "biens-prix", type: "symbol", source: "biens", filter: ["!", ["has", "point_count"]],
            layout: {
              "text-field": ["get", "prix"], "text-font": ["Source Sans Pro Bold"], "text-size": 13.5,
              "text-offset": [0, -1.7], "text-anchor": "bottom", "text-allow-overlap": false,
            },
            paint: { "text-color": "#111827", "text-halo-color": "#ffffff", "text-halo-width": 2 },
          });

          map.on("click", "biens-groupes", async (e) => {
            const f = e.features?.[0] as MapGeoJSONFeature | undefined;
            if (!f) return;
            const zoom = await (map.getSource("biens") as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id as number);
            map.easeTo({ center: (f.geometry as unknown as { coordinates: [number, number] }).coordinates, zoom });
          });
          map.on("click", "biens-points", (e) => {
            const p = byId.get(String(e.features?.[0]?.properties.id ?? ""));
            if (p) openPopup(p);
          });
          map.on("click", "ventes-points", (e) => {
            const f = e.features?.[0];
            if (!f) return;
            popupRef.current?.remove();
            popupRef.current = new lib.Popup({ offset: 8, maxWidth: "240px" })
              .setLngLat((f.geometry as unknown as { coordinates: [number, number] }).coordinates)
              .setDOMContent(salePopup(f.properties as unknown as MapSale))
              .addTo(map);
          });
          for (const layer of ["biens-groupes", "biens-points", "ventes-points"]) {
            map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
            map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
          }
          map.on("mousemove", "biens-points", (e) => setHovered(String(e.features?.[0]?.properties.id ?? "") || null));
          map.on("mouseleave", "biens-points", () => setHovered(null));

          let controller: AbortController | null = null;
          const loadSales = async () => {
            const src = map.getSource("ventes") as GeoJSONSource | undefined;
            if (!src) return;
            if (!showSalesRef.current) {
              src.setData({ type: "FeatureCollection", features: [] });
              return setSalesInfo("");
            }
            if (map.getZoom() < SALES_MIN_ZOOM) {
              src.setData({ type: "FeatureCollection", features: [] });
              return setSalesInfo("Zoomez sur un quartier pour voir les ventes réelles.");
            }
            controller?.abort();
            controller = new AbortController();
            const b = map.getBounds();
            const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((v) => v.toFixed(5)).join(",");
            try {
              const res = await fetch(`/api/v1/carte/ventes?bbox=${bbox}`, { signal: controller.signal });
              const data = (await res.json()) as { sales?: MapSale[]; truncated?: boolean; tooWide?: boolean };
              const sales = data.sales ?? [];
              src.setData({
                type: "FeatureCollection",
                features: sales.map((s) => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.lon, s.lat] }, properties: { ...s } })),
              });
              setSalesInfo(
                data.tooWide ? "Zoomez sur un quartier pour voir les ventes réelles."
                  : sales.length === 0 ? "Aucune vente réelle chargée dans cette zone."
                  : `${num.format(sales.length)} vente(s) réelle(s) des 24 derniers mois${data.truncated ? " (les plus récentes)" : ""}.`,
              );
            } catch (err) {
              if ((err as Error).name !== "AbortError") setSalesInfo("Ventes réelles momentanément indisponibles.");
            }
          };
          map.on("moveend", () => void loadSales());
          (map as MlMap & { reloadSales?: () => void }).reloadSales = () => void loadSales();

          const pts = properties.map((p) => [p.lon, p.lat] as [number, number]);
          if (pts.length) {
            const bounds = pts.reduce((b, pt) => b.extend(pt), new lib.LngLatBounds(pts[0]!, pts[0]!));
            map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
          }
          setMapState("prete");
          void loadSales();
        });
      })
      .catch(() => setMapState("indisponible"));
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // La carte n'est créée qu'une fois (les biens viennent du serveur) ; les critères sont appliqués ci-dessous.
  }, [properties, byId]);

  // Biens filtrés sur la carte.
  useEffect(() => {
    if (mapState !== "prete") return;
    (mapRef.current?.getSource("biens") as GeoJSONSource | undefined)?.setData(toGeoJson(visible));
  }, [visible, mapState]);

  // Lieu choisi : déplacement de la carte et cercle du rayon.
  useEffect(() => {
    const map = mapRef.current;
    if (mapState !== "prete" || !map) return;
    (map.getSource("rayon") as GeoJSONSource | undefined)?.setData(
      place && filters.radiusKm
        ? { type: "Feature", geometry: { type: "Polygon", coordinates: [circlePolygon(place, filters.radiusKm)] }, properties: {} }
        : { type: "FeatureCollection", features: [] },
    );
    if (!place) return;
    if (filters.radiusKm) {
      const ring = circlePolygon(place, filters.radiusKm);
      const lons = ring.map((r) => r[0]);
      const lats = ring.map((r) => r[1]);
      map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 40 });
    } else {
      map.flyTo({ center: [place.lon, place.lat], zoom: place.type === "municipality" ? 13 : place.type === "street" ? 15 : 16 });
    }
  }, [place, filters.radiusKm, mapState]);

  // Survol d'une carte de la liste ⇄ mise en avant sur la carte.
  useEffect(() => {
    const map = mapRef.current;
    if (mapState !== "prete" || !map || !hovered) return;
    map.setFeatureState({ source: "biens", id: hovered }, { survol: true });
    return () => {
      // La carte peut déjà avoir été retirée (changement de page) : ne plus y toucher.
      if (mapRef.current === map && map.getSource("biens")) map.setFeatureState({ source: "biens", id: hovered }, { survol: false });
    };
  }, [hovered, mapState]);

  useEffect(() => {
    showSalesRef.current = showSales;
    (mapRef.current as (MlMap & { reloadSales?: () => void }) | null)?.reloadSales?.();
  }, [showSales]);

  useEffect(() => {
    const map = mapRef.current;
    if (mapState !== "prete" || !map) return;
    map.setLayoutProperty("ortho", "visibility", satellite ? "visible" : "none");
  }, [satellite, mapState]);

  const set = <K extends keyof MapFilters>(k: K, v: MapFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const numberOrNull = (v: string) => (v.replace(/\D/g, "") === "" ? null : Number(v.replace(/\D/g, "")));
  function toggleIn<T>(values: ReadonlySet<T>, v: T): Set<T> {
    const next = new Set(values);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  }
  const input = "h-9 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-2.5 text-sm text-ink";
  const numField = (label: string, key: "minPrice" | "maxPrice" | "minSurface" | "maxSurface" | "minRooms" | "maxPricePerSqm") => (
    <label className="block space-y-1 text-[13px] font-medium text-ink">
      {label}
      <input className={input} inputMode="numeric" value={filters[key] ?? ""} onChange={(e) => set(key, numberOrNull(e.target.value))} />
    </label>
  );

  return (
    <div className="space-y-4">
      <section aria-label="Critères de recherche" className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <PlaceSearch value={place} onChange={setPlace} />
          <label className="block space-y-1 text-[13px] font-medium text-ink">
            Rayon autour du lieu
            <select className={input} value={filters.radiusKm ?? ""} disabled={!place} onChange={(e) => set("radiusKm", e.target.value ? Number(e.target.value) : null)}>
              {RADII.map((r) => (
                <option key={r ?? "aucun"} value={r ?? ""}>{r === null ? "Pas de limite" : r < 1 ? `${r * 1000} m` : `${r} km`}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-[13px] font-medium text-ink">
            Type de bien
            <select className={input} value={filters.type} onChange={(e) => set("type", e.target.value as MapFilters["type"])}>
              <option value="tous">Tous</option>
              <option value="Appartement">Appartement</option>
              <option value="Maison">Maison</option>
            </select>
          </label>
          {numField("Prix maximum (€)", "maxPrice")}
          {numField("Surface minimum (m²)", "minSurface")}
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-brand-text">Plus de critères</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {numField("Prix minimum (€)", "minPrice")}
            {numField("Surface maximum (m²)", "maxSurface")}
            {numField("Pièces minimum", "minRooms")}
            {numField("Prix au m² maximum (€)", "maxPricePerSqm")}
            <label className="block space-y-1 text-[13px] font-medium text-ink">
              Performance énergétique (DPE)
              <select className={input} value={filters.worstDpe ?? ""} onChange={(e) => set("worstDpe", (e.target.value || null) as MapFilters["worstDpe"])}>
                <option value="">Toutes</option>
                {DPE_ORDER.slice(0, 6).map((c, i) => (
                  <option key={c} value={c}>{i === 0 ? "A seulement" : `A à ${c}`}</option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="mt-3">
            <legend className="text-[13px] font-medium text-ink">Équipements (tous requis)</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {Object.entries(PROPERTY_FEATURES).map(([k, label]) => (
                <label key={k} className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]", filters.features.has(k) ? "border-brand bg-brand-soft text-brand-text" : "border-line-strong text-ink")}>
                  <input type="checkbox" className="sr-only" checked={filters.features.has(k)} onChange={() => set("features", toggleIn(filters.features, k))} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-3">
            <legend className="text-[13px] font-medium text-ink">Statut</legend>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
              {(Object.keys(PROPERTY_STATUS) as MapProperty["status"][]).map((s) => (
                <label key={s} className="inline-flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" className="size-4 accent-brand" checked={filters.statuses.has(s)} onChange={() => set("statuses", toggleIn(filters.statuses, s))} />
                  {PROPERTY_STATUS[s]}
                </label>
              ))}
            </div>
          </fieldset>
        </details>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-ink">
            <input type="checkbox" className="size-4 accent-brand" checked={filters.dealsOnly} onChange={(e) => set("dealsOnly", e.target.checked)} />
            Bonnes affaires seulement
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="size-4 accent-brand" checked={filters.withPhotos} onChange={(e) => set("withPhotos", e.target.checked)} />
            Avec photos
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="size-4 accent-brand" checked={filters.mineOnly} onChange={(e) => set("mineOnly", e.target.checked)} />
            Mes biens seulement
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="size-4 accent-brand" checked={showSales} onChange={(e) => setShowSales(e.target.checked)} />
            Ventes réelles (DVF)
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="size-4 accent-brand" checked={satellite} onChange={(e) => setSatellite(e.target.checked)} />
            Vue satellite
          </label>
          <button
            type="button"
            className="ml-auto text-sm text-ink-muted underline hover:text-ink"
            onClick={() => {
              setFilters(initialFilters);
              setPlace(null);
            }}
          >
            Réinitialiser
          </button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-labelledby="liste-biens" className="order-2 flex min-h-0 flex-col rounded-[var(--radius-card)] border border-line bg-surface lg:order-1 lg:h-[72vh]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 id="liste-biens" className="text-[15px] font-semibold text-ink">{visible.length} bien(s) correspondant(s)</h2>
            <label className="inline-flex items-center gap-2 text-xs text-ink-muted">
              Trier par
              <select className="h-8 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2 text-xs text-ink" value={filters.sort} onChange={(e) => set("sort", e.target.value as SortKey)}>
                <option value="affaires">Meilleures affaires</option>
                <option value="prix_asc">Prix croissant</option>
                <option value="prix_desc">Prix décroissant</option>
                <option value="prix_m2">Prix au m²</option>
                <option value="surface">Surface</option>
              </select>
            </label>
          </div>
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted">Aucun bien ne correspond à ces critères.</p>
          ) : (
            <div role="region" aria-label="Biens correspondants (défilable)" tabIndex={0} className="min-h-0 flex-1 overflow-auto p-3">
            <ul className="space-y-3">
              {visible.map((p) => (
                <li
                  key={p.id}
                  onMouseEnter={() => setHovered(p.id)}
                  onMouseLeave={() => setHovered(null)}
                  className={cn("overflow-hidden rounded-[var(--radius-control)] border bg-surface transition-shadow", hovered === p.id ? "border-brand shadow-[var(--shadow-card)]" : "border-line")}
                >
                  <div className="flex gap-3">
                    <div className="relative h-28 w-36 shrink-0 bg-surface-muted">
                      {p.photoId ? (
                        <img src={photoUrl(p.photoId)} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-xs text-ink-muted">Pas de photo</span>
                      )}
                      {p.photoCount > 1 ? <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 text-[11px] text-white">{p.photoCount} photos</span> : null}
                    </div>
                    <div className="min-w-0 flex-1 py-2 pr-3">
                      <p className="text-base font-semibold text-ink">{p.price ? euros.format(p.price) : "Prix non renseigné"}</p>
                      <p className="text-xs text-ink-muted">
                        {p.type}{p.surface ? ` · ${num.format(p.surface)} m²` : ""}{p.rooms ? ` · ${p.rooms} p.` : ""}
                        {p.price && p.surface ? ` · ${num.format(p.price / p.surface)} €/m²` : ""}
                      </p>
                      <p className="truncate text-xs text-ink-muted">{p.label}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge tone={p.position.kind === "sous_marche" ? "success" : p.position.kind === "au_dessus" ? "warning" : "neutral"}>
                          {marketPositionLabel(p.position)}
                        </Badge>
                        {p.dpeClass ? <span className="text-[11px] text-ink-muted">DPE {p.dpeClass}</span> : null}
                      </div>
                      <div className="mt-1.5 flex gap-3 text-xs">
                        <Link href={sheetUrl(p.id)} className="font-medium text-brand-text underline-offset-2 hover:underline" aria-label={`Voir la fiche : ${p.label}`}>
                          Voir la fiche
                        </Link>
                        <button
                          type="button"
                          className="text-ink-muted hover:text-ink"
                          aria-label={`Montrer sur la carte : ${p.label}`}
                          onClick={() => {
                            mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: 16 });
                            openPopup(p);
                          }}
                        >
                          Sur la carte
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            </div>
          )}
        </section>

        <div className="order-1 space-y-2 lg:order-2">
          <div className="relative h-[55vh] overflow-hidden rounded-[var(--radius-card)] border border-line lg:h-[72vh]">
            <div ref={containerRef} role="region" aria-label="Carte des biens de l'agence et des ventes réelles" data-state={mapState} className="h-full w-full" />
            {mapState !== "prete" ? (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-muted/70 text-sm text-ink-muted">
                {mapState === "chargement" ? "Chargement de la carte…" : "Carte indisponible sur cet appareil : la liste reste utilisable."}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted" aria-label="Légende">
            {([["sous_marche", "Sous le marché"], ["dans_marche", "Dans le marché"], ["au_dessus", "Au-dessus"], ["inconnu", "Non comparable"], ["vente", "Vente réelle"]] as const).map(([k, label]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span aria-hidden className="inline-block size-3 rounded-full" style={{ background: COLORS[k] }} />
                {label}
              </span>
            ))}
            <span role="status" className="ml-auto">{salesInfo}</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-ink-muted">
        Repère « bonne affaire » : prix au m² comparé à la médiane des ventes réelles de la commune (même type de bien, 24 derniers mois),
        sans tenir compte de l&apos;état, de l&apos;étage ni de la vue. Les annonces des autres agences et des particuliers ne sont pas incluses.
      </p>
    </div>
  );
}
