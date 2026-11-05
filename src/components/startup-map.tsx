"use client";

import * as maplibregl from "maplibre-gl";
import {
  type GeoJSONSource,
  type Map as MapType,
  type MapGeoJSONFeature,
  type MapMouseEvent,
} from "maplibre-gl";
import Link from "next/link";
import { Crosshair, ExternalLink, LoaderCircle, MapPin, Search, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BANGALORE_CENTER, INDUSTRIES, NEIGHBOURHOODS } from "@/lib/constants";
import type { Startup } from "@/lib/types";
import { safeUrl } from "@/lib/utils";

// MapLibre 6 resolves its default worker relative to the bundled library module.
// This explicit package URL makes Turbopack emit a real hashed JavaScript asset.
maplibregl.setWorkerUrl(
  new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString(),
);

const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() ||
  "https://tiles.openfreemap.org/styles/liberty";

type ApiResponse = {
  features: GeoJSON.Feature<GeoJSON.Point, { id: string; featured: boolean }>[];
  startups: Startup[];
};
type MapState = "loading" | "ready" | "error";

export function StartupMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapType | null>(null);
  const startupsRef = useRef<Startup[]>([]);
  const filtersRef = useRef({ query: "", industry: "", neighbourhood: "" });
  const [startups, setStartups] = useState<Startup[]>([]);
  const [selected, setSelected] = useState<Startup | null>(null);
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("");
  const [neighbourhood, setNeighbourhood] = useState("");
  const [mapState, setMapState] = useState<MapState>("loading");
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(false);

  useEffect(() => {
    startupsRef.current = startups;
  }, [startups]);

  const load = useCallback(async (map: MapType) => {
    const bounds = map.getBounds();
    const { query: q, industry: i, neighbourhood: n } = filtersRef.current;
    const params = new URLSearchParams({
      west: String(bounds.getWest()),
      south: String(bounds.getSouth()),
      east: String(bounds.getEast()),
      north: String(bounds.getNorth()),
      q,
      industry: i,
      neighbourhood: n,
    });

    setDataLoading(true);
    setDataError(false);
    try {
      const response = await fetch(`/api/startups/map?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Map API returned ${response.status}`);
      const data: ApiResponse = await response.json();
      setStartups(data.startups);
      (map.getSource("startups") as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: data.features,
      });
    } catch (error) {
      setDataError(true);
      if (process.env.NODE_ENV === "development") {
        console.error("[StartupMap] Unable to load startup data", error);
      }
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!container.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE_URL,
      center: [BANGALORE_CENTER.longitude, BANGALORE_CENTER.latitude],
      zoom: BANGALORE_CENTER.zoom,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.on("error", (event) => {
      setMapState("error");
      if (process.env.NODE_ENV === "development") {
        console.error("[StartupMap] MapLibre resource error", {
          message: event.error?.message,
        });
      }
    });

    map.on("load", () => {
      map.addSource("startups", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 48,
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "startups",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#70a5ff",
          "circle-radius": ["step", ["get", "point_count"], 18, 20, 24, 80, 30],
          "circle-stroke-width": 4,
          "circle-stroke-color": "rgba(112,165,255,.2)",
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "startups",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 12,
        },
        paint: { "text-color": "#07101f" },
      });
      map.addLayer({
        id: "startup-points",
        type: "circle",
        source: "startups",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["case", ["get", "featured"], "#b8f56a", "#70a5ff"],
          "circle-radius": ["case", ["get", "featured"], 10, 7],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#10141b",
        },
      });

      map.on("click", "clusters", async (event: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        const feature = map.queryRenderedFeatures(event.point, { layers: ["clusters"] })[0];
        if (!feature) return;
        const source = map.getSource("startups") as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(Number(feature.properties?.cluster_id));
        map.easeTo({
          center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
          zoom,
        });
      });
      map.on("click", "startup-points", (event: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        const id = event.features?.[0]?.properties?.id;
        setSelected(startupsRef.current.find((startup) => startup.id === id) ?? null);
      });
      map.on("mouseenter", ["clusters", "startup-points"], () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", ["clusters", "startup-points"], () => {
        map.getCanvas().style.cursor = "";
      });

      setMapState("ready");
      void load(map);
    });
    map.on("moveend", () => void load(map));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [load]);

  useEffect(() => {
    filtersRef.current = { query, industry, neighbourhood };
    if (!mapRef.current?.isStyleLoaded()) return;
    const timeout = window.setTimeout(() => {
      if (mapRef.current) void load(mapRef.current);
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [industry, load, neighbourhood, query]);

  return (
    <div className="relative">
      <div className="grid gap-2 border-b border-line bg-surface p-3 md:grid-cols-[1fr_220px_220px_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-3 text-muted" size={17} />
          <input
            className="field pl-10"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, industry or keyword"
          />
        </label>
        <select
          className="field"
          value={industry}
          onChange={(event) => setIndustry(event.target.value)}
        >
          <option value="">All industries</option>
          {INDUSTRIES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select
          className="field"
          value={neighbourhood}
          onChange={(event) => setNeighbourhood(event.target.value)}
        >
          <option value="">All neighbourhoods</option>
          {NEIGHBOURHOODS.map((item) => <option key={item}>{item}</option>)}
        </select>
        <button
          className="btn btn-secondary px-3"
          onClick={() => mapRef.current?.flyTo({
            center: [BANGALORE_CENTER.longitude, BANGALORE_CENTER.latitude],
            zoom: BANGALORE_CENTER.zoom,
          })}
          aria-label="Recenter map"
        >
          <Crosshair size={18} />
        </button>
      </div>

      <div ref={container} className="h-[520px] bg-[#d8e8f5] md:h-[620px]" />

      {mapState === "loading" && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center">
          <div className="flex items-center gap-2 rounded-md border border-line bg-background/90 px-4 py-3 text-sm text-muted shadow-lg backdrop-blur">
            <LoaderCircle className="animate-spin" size={17} /> Loading map…
          </div>
        </div>
      )}
      {mapState === "error" && (
        <div className="absolute inset-x-4 top-24 z-10 mx-auto max-w-md rounded-lg border border-red-400/40 bg-background/95 p-4 text-sm shadow-xl backdrop-blur">
          <p className="flex items-center gap-2 font-semibold text-red-300">
            <TriangleAlert size={17} /> Map tiles could not be loaded.
          </p>
          <p className="mt-2 text-muted">Check your connection, then reload the page. Startup search remains available in the directory.</p>
        </div>
      )}
      {mapState === "ready" && !dataLoading && !dataError && startups.length === 0 && (
        <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-line bg-background/95 p-4 shadow-xl backdrop-blur">
          <p className="text-sm font-medium">No verified startups in this area yet.</p>
          <Link className="btn btn-primary mt-3 py-2 text-xs" href="/submit-startup">Submit a startup</Link>
        </div>
      )}
      {dataLoading && mapState === "ready" && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-md border border-line bg-background/90 px-3 py-2 text-xs text-muted backdrop-blur">
          <LoaderCircle className="animate-spin" size={14} /> Loading verified startups…
        </div>
      )}
      {dataError && (
        <div className="absolute bottom-4 left-4 z-10 rounded-md border border-red-400/40 bg-background/95 px-4 py-3 text-sm text-red-200 shadow-lg backdrop-blur">
          Startup data is temporarily unavailable.
        </div>
      )}
      {mapState === "ready" && !dataLoading && !dataError && startups.length > 0 && (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-md border border-line bg-background/90 px-3 py-2 text-xs text-muted backdrop-blur">
          {startups.length} {startups.length === 1 ? "startup" : "startups"} in this view
        </div>
      )}

      {selected && (
        <div className="absolute bottom-4 right-4 z-20 w-[calc(100%-2rem)] max-w-sm rounded-xl border border-line bg-[#111722]/95 p-5 shadow-2xl backdrop-blur">
          <button className="absolute right-3 top-3 text-muted hover:text-white" onClick={() => setSelected(null)} aria-label="Close">
            <X size={18} />
          </button>
          <div className="flex gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-line bg-card font-bold text-accent">
              {selected.logo_url ? (
                // The logo host is user-supplied and cannot be safely allow-listed for next/image.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.logo_url} alt="" className="h-full w-full rounded-lg object-cover" />
              ) : selected.name.slice(0, 2).toUpperCase()}
            </div>
            <div><p className="font-semibold">{selected.name}</p><p className="mt-1 text-xs text-accent">{selected.industry}</p></div>
          </div>
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted">{selected.description || "No description available."}</p>
          <p className="mt-3 flex items-center gap-1 text-xs text-muted"><MapPin size={13} />{selected.neighbourhood || "Bangalore"}</p>
          <div className="mt-4 flex gap-2">
            <Link className="btn btn-primary flex-1 py-2 text-sm" href={`/startups/${selected.slug}`}>View profile</Link>
            {safeUrl(selected.website) && (
              <a className="btn btn-secondary px-3 py-2" href={safeUrl(selected.website)!} target="_blank" rel="noreferrer" aria-label="Visit website">
                <ExternalLink size={16} />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
