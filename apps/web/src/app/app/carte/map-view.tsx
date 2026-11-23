"use client";
/**
 * Carte des biens (Leaflet, fond IGN Géoplateforme sans clé). Les popups sont construits avec
 * des nœuds DOM (textContent), jamais du HTML : aucune donnée saisie ne peut s'exécuter.
 * La liste sous la carte est l'alternative accessible (lecteur d'écran, clavier).
 */
import "leaflet/dist/leaflet.css";
import { marketPositionLabel } from "@immopilot/domain";
import type { CircleMarker, LayerGroup, Map as LeafletMap } from "leaflet";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PROPERTY_STATUS } from "@/lib/crm/labels";
import type { MapProperty, MapSale } from "@/lib/map/data";
import { cn } from "@/ui/cn";
import { Badge } from "@/ui/surface";

const IGN_TILES =
  "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2" +
  "&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png";
const SALES_MIN_ZOOM = 13;

// Couleurs lisibles sur le fond IGN (clair) dans les deux thèmes.
const COLORS = { sous_marche: "#0f7258", dans_marche: "#1d4380", au_dessus: "#b45309", inconnu: "#626b7e", vente: "#7c3aed" } as const;

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const dateFr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

type Filters = {
  type: "tous" | "Appartement" | "Maison";
  statuses: Set<MapProperty["status"]>;
  maxPrice: string;
  minSurface: string;
  minRooms: string;
  dealsOnly: boolean;
  mineOnly: boolean;
  showSales: boolean;
};

function line(parent: HTMLElement, text: string, className?: string) {
  const p = document.createElement("p");
  p.textContent = text;
  if (className) p.className = className;
  parent.append(p);
}

function propertyPopup(p: MapProperty): HTMLElement {
  const root = document.createElement("div");
  const a = document.createElement("a");
  a.href = `/app/proprietes/${p.id}`;
  a.textContent = p.label;
  a.className = "font-medium underline";
  root.append(a);
  line(root, `${p.type}${p.surface ? ` · ${num.format(p.surface)} m²` : ""}${p.rooms ? ` · ${p.rooms} p.` : ""} · ${PROPERTY_STATUS[p.status]}`);
  if (p.price) line(root, `${euros.format(p.price)}${p.surface ? ` (${num.format(p.price / p.surface)} €/m²)` : ""}`);
  line(root, marketPositionLabel(p.position));
  if (p.position.kind !== "inconnu") line(root, `Médiane de la commune : ${num.format(p.position.median)} €/m² (${p.position.sales} ventes, 24 mois)`, "text-xs");
  return root;
}

function salePopup(s: MapSale): HTMLElement {
  const root = document.createElement("div");
  line(root, `Vente réelle du ${dateFr(s.date)}`, "font-medium");
  line(root, `${s.type} · ${num.format(s.surface)} m² · ${euros.format(s.price)}`);
  line(root, `${num.format(s.pricePerSqm)} €/m²`);
  line(root, "Source : DVF (DGFiP), adresse non affichée.", "text-xs");
  return root;
}

export function MapView({ properties }: { properties: MapProperty[] }) {
  const [filters, setFilters] = useState<Filters>({
    type: "tous", statuses: new Set(["mandat", "sous_offre"]), maxPrice: "", minSurface: "", minRooms: "",
    dealsOnly: false, mineOnly: false, showSales: true,
  });
  const [salesInfo, setSalesInfo] = useState("");
  // Leaflet se charge après le premier affichage : les biens sont dessinés une fois la carte prête.
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const propLayer = useRef<LayerGroup | null>(null);
  const saleLayer = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const showSalesRef = useRef(filters.showSales);

  const visible = useMemo(() => {
    const maxPrice = Number(filters.maxPrice) || null;
    const minSurface = Number(filters.minSurface) || null;
    const minRooms = Number(filters.minRooms) || null;
    return properties
      .filter((p) => (filters.type === "tous" || p.type === filters.type) && filters.statuses.has(p.status))
      .filter((p) => (maxPrice === null || (p.price !== null && p.price <= maxPrice)) && (minSurface === null || (p.surface ?? 0) >= minSurface))
      .filter((p) => (minRooms === null || (p.rooms ?? 0) >= minRooms) && (!filters.dealsOnly || p.position.kind === "sous_marche") && (!filters.mineOnly || p.mine))
      .sort((a, b) => (a.position.kind === "inconnu" ? 1 : a.position.gap) - (b.position.kind === "inconnu" ? 1 : b.position.gap));
  }, [properties, filters]);

  // Création de la carte (une fois).
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false });
      L.control.zoom({ zoomInTitle: "Zoomer", zoomOutTitle: "Dézoomer" }).addTo(map);
      L.control.attribution({ prefix: false }).addTo(map);
      L.tileLayer(IGN_TILES, { minZoom: 5, maxZoom: 19, attribution: "© IGN – Géoplateforme" }).addTo(map);
      propLayer.current = L.layerGroup().addTo(map);
      saleLayer.current = L.layerGroup().addTo(map);
      const pts = properties.map((p) => [p.lat, p.lon] as [number, number]);
      if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
      else map.setView([46.6, 2.4], 6); // France entière
      map.getContainer().setAttribute("aria-label", "Carte des biens de l'agence et des ventes réelles");
      mapRef.current = map;

      let controller: AbortController | null = null;
      const loadSales = async () => {
        saleLayer.current?.clearLayers();
        if (!showSalesRef.current) return setSalesInfo("");
        if (map.getZoom() < SALES_MIN_ZOOM) return setSalesInfo("Zoomez sur un quartier pour afficher les ventes réelles.");
        controller?.abort();
        controller = new AbortController();
        const b = map.getBounds();
        const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((v) => v.toFixed(5)).join(",");
        try {
          const res = await fetch(`/api/v1/carte/ventes?bbox=${bbox}`, { signal: controller.signal });
          const data = (await res.json()) as { sales?: MapSale[]; truncated?: boolean; tooWide?: boolean };
          const sales = data.sales ?? [];
          saleLayer.current?.clearLayers();
          for (const s of sales) {
            L.circleMarker([s.lat, s.lon], { radius: 4, color: COLORS.vente, weight: 1, fillOpacity: 0.5 })
              .bindPopup(() => salePopup(s))
              .addTo(saleLayer.current!);
          }
          setSalesInfo(
            data.tooWide ? "Zoomez sur un quartier pour afficher les ventes réelles."
              : sales.length === 0 ? "Aucune vente réelle chargée dans cette zone."
              : `${num.format(sales.length)} vente(s) réelle(s) des 24 derniers mois${data.truncated ? " (les plus récentes)" : ""}.`,
          );
        } catch (e) {
          if ((e as Error).name !== "AbortError") setSalesInfo("Ventes réelles momentanément indisponibles.");
        }
      };
      map.on("moveend", () => void loadSales());
      (map as LeafletMap & { reloadSales?: () => void }).reloadSales = () => void loadSales();
      void loadSales();
      setReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // La carte n'est créée qu'une fois ; les filtres sont appliqués par l'effet suivant.
  }, [properties]);

  // Biens filtrés.
  useEffect(() => {
    const L = leafletRef.current;
    const layer = propLayer.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    for (const p of visible) {
      const marker: CircleMarker = L.circleMarker([p.lat, p.lon], {
        radius: 9, color: "#ffffff", weight: 2, fillColor: COLORS[p.position.kind], fillOpacity: 0.95,
      });
      const tip = document.createElement("span");
      tip.textContent = p.label; // jamais de HTML : Leaflet insère une chaîne telle quelle
      marker.bindPopup(() => propertyPopup(p)).bindTooltip(tip).addTo(layer);
    }
  }, [visible, ready]);

  // Calque des ventes réelles affiché ou masqué.
  useEffect(() => {
    showSalesRef.current = filters.showSales;
    (mapRef.current as (LeafletMap & { reloadSales?: () => void }) | null)?.reloadSales?.();
  }, [filters.showSales]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const toggleStatus = (s: MapProperty["status"]) =>
    setFilters((f) => {
      const statuses = new Set(f.statuses);
      if (statuses.has(s)) statuses.delete(s);
      else statuses.add(s);
      return { ...f, statuses };
    });
  const input = "h-9 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-2.5 text-sm text-ink";

  return (
    <div className="space-y-4">
      <fieldset className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="px-1 text-sm font-semibold text-ink">Mes critères</legend>
        <label className="space-y-1 text-[13px] font-medium text-ink">
          Type de bien
          <select className={input} value={filters.type} onChange={(e) => set("type", e.target.value as Filters["type"])}>
            <option value="tous">Tous</option>
            <option value="Appartement">Appartement</option>
            <option value="Maison">Maison</option>
          </select>
        </label>
        <label className="space-y-1 text-[13px] font-medium text-ink">
          Prix maximum (€)
          <input className={input} inputMode="numeric" value={filters.maxPrice} onChange={(e) => set("maxPrice", e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="space-y-1 text-[13px] font-medium text-ink">
          Surface minimum (m²)
          <input className={input} inputMode="numeric" value={filters.minSurface} onChange={(e) => set("minSurface", e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="space-y-1 text-[13px] font-medium text-ink">
          Pièces minimum
          <input className={input} inputMode="numeric" value={filters.minRooms} onChange={(e) => set("minRooms", e.target.value.replace(/\D/g, ""))} />
        </label>
        <div className="flex flex-wrap gap-x-4 gap-y-2 sm:col-span-2 lg:col-span-4">
          {(Object.keys(PROPERTY_STATUS) as MapProperty["status"][]).map((s) => (
            <label key={s} className="inline-flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="size-4 accent-brand" checked={filters.statuses.has(s)} onChange={() => toggleStatus(s)} />
              {PROPERTY_STATUS[s]}
            </label>
          ))}
          <label className="inline-flex items-center gap-2 text-sm font-medium text-ink">
            <input type="checkbox" className="size-4 accent-brand" checked={filters.dealsOnly} onChange={(e) => set("dealsOnly", e.target.checked)} />
            Bonnes affaires seulement
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="size-4 accent-brand" checked={filters.mineOnly} onChange={(e) => set("mineOnly", e.target.checked)} />
            Mes biens seulement
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="size-4 accent-brand" checked={filters.showSales} onChange={(e) => set("showSales", e.target.checked)} />
            Ventes réelles (DVF)
          </label>
        </div>
      </fieldset>

      <div ref={containerRef} tabIndex={0} role="region" className="h-[60vh] min-h-[360px] w-full overflow-hidden rounded-[var(--radius-card)] border border-line" />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted" aria-label="Légende">
        {([["sous_marche", "Sous le marché (−10 % ou plus)"], ["dans_marche", "Dans le marché"], ["au_dessus", "Au-dessus du marché (+10 % ou plus)"], ["inconnu", "Non comparable"], ["vente", "Vente réelle (DVF)"]] as const).map(([k, label]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-3 rounded-full" style={{ background: COLORS[k] }} />
            {label}
          </span>
        ))}
        <span role="status" className="ml-auto">{salesInfo}</span>
      </div>

      <section aria-labelledby="liste-biens" className="rounded-[var(--radius-card)] border border-line bg-surface">
        <h2 id="liste-biens" className="border-b border-line px-5 py-3 text-[15px] font-semibold text-ink">
          {visible.length} bien(s) correspondant(s), les meilleures affaires d&apos;abord
        </h2>
        {visible.length === 0 ? (
          <p className="px-5 py-4 text-sm text-ink-muted">Aucun bien ne correspond à ces critères.</p>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5">
                <Link href={`/app/proprietes/${p.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-ink underline-offset-2 hover:underline">
                  {p.label}
                </Link>
                <span className="text-xs text-ink-muted">
                  {p.type}{p.surface ? ` · ${num.format(p.surface)} m²` : ""}{p.price ? ` · ${euros.format(p.price)}` : ""}
                  {p.price && p.surface ? ` (${num.format(p.price / p.surface)} €/m²)` : ""}
                </span>
                <Badge tone={p.position.kind === "sous_marche" ? "success" : p.position.kind === "au_dessus" ? "warning" : "neutral"}>
                  {marketPositionLabel(p.position)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className={cn("text-xs text-ink-muted")}>
        Repère, pas une estimation : la médiane des ventes réelles de la commune (même type de bien, 24 derniers mois) ne tient compte ni
        de l&apos;état, ni de l&apos;étage, ni de la vue. Pour un avis de valeur, ouvrez le dossier du bien.
      </p>
    </div>
  );
}
