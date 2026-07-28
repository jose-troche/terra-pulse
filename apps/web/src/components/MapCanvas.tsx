import { useEffect, useMemo, useRef, useState } from "react";
import {
  AttributionControl,
  Map,
  type ExpressionSpecification,
  type ErrorEvent,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type Map as MapLibreMap,
  type StyleSpecification
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { EarthEvent, EventType } from "@terra-pulse/earth-domain";
import { Focus, Globe2, Map as MapIcon, Minus, Plus } from "lucide-react";
import { eventColors } from "../lib/format";

interface MapCanvasProps {
  events: EarthEvent[];
  activeTypes: Set<EventType>;
  selectedId?: string;
  onSelect: (eventId: string) => void;
}

const mapStyle: StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#061613" }
    },
    {
      id: "osm",
      type: "raster",
      source: "osm",
      paint: {
        "raster-saturation": -0.86,
        "raster-contrast": 0.22,
        "raster-brightness-min": 0.05,
        "raster-brightness-max": 0.42,
        "raster-opacity": 0.9
      }
    }
  ]
};

const colorExpression: ExpressionSpecification = [
  "match",
  ["get", "type"],
  "earthquake",
  eventColors.earthquake,
  "wildfire",
  eventColors.wildfire,
  "storm",
  eventColors.storm,
  "flood",
  eventColors.flood,
  "volcano",
  eventColors.volcano,
  "air_quality",
  eventColors.air_quality,
  "climate",
  eventColors.climate,
  "#d5eadf"
];

export function MapCanvas({
  events,
  activeTypes,
  selectedId,
  onSelect
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const [projection, setProjection] = useState<"globe" | "mercator">("globe");
  const [mapError, setMapError] = useState(false);

  onSelectRef.current = onSelect;

  const visibleEvents = useMemo(
    () => events.filter((event) => activeTypes.has(event.type)),
    [activeTypes, events]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    try {
      const map = new Map({
        container: containerRef.current,
        style: mapStyle,
        center: [8, 18],
        zoom: 1.45,
        minZoom: 1,
        maxZoom: 9,
        attributionControl: false,
        renderWorldCopies: false,
        canvasContextAttributes: { antialias: true }
      });
      mapRef.current = map;
      map.addControl(
        new AttributionControl({ compact: true }),
        "bottom-right"
      );
      map.on("load", () => {
        map.addSource("earth-events", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] }
        });
        map.addLayer({
          id: "event-halo",
          type: "circle",
          source: "earth-events",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "riskScore"],
              0,
              8,
              100,
              24
            ],
            "circle-color": colorExpression,
            "circle-opacity": 0.12,
            "circle-blur": 0.55
          }
        });
        map.addLayer({
          id: "event-points",
          type: "circle",
          source: "earth-events",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "riskScore"],
              0,
              4,
              100,
              9
            ],
            "circle-color": colorExpression,
            "circle-stroke-color": "rgba(255,255,255,.9)",
            "circle-stroke-width": [
              "case",
              ["==", ["get", "id"], selectedId ?? ""],
              2.5,
              0.8
            ],
            "circle-opacity": 0.94
          }
        });
        map.on("mouseenter", "event-points", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "event-points", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", "event-points", (event) => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === "string") onSelectRef.current(id);
        });
      });
      map.on("error", (event: ErrorEvent) => {
        if (String(event.error?.message ?? "").toLowerCase().includes("webgl")) {
          setMapError(true);
        }
      });
      const canvas = map.getCanvas();
      canvas.setAttribute("aria-label", "Interactive globe of active Earth events");
      canvas.setAttribute("role", "application");
    } catch {
      setMapError(true);
    }
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      const source = map.getSource("earth-events") as GeoJSONSource | undefined;
      source?.setData({
        type: "FeatureCollection",
        features: visibleEvents.map((event) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [
              event.coordinates.longitude,
              event.coordinates.latitude
            ]
          },
          properties: {
            id: event.id,
            type: event.type,
            title: event.title,
            riskScore: event.riskScore
          }
        }))
      });
      if (map.getLayer("event-points")) {
        map.setPaintProperty("event-points", "circle-stroke-width", [
          "case",
          ["==", ["get", "id"], selectedId ?? ""],
          2.5,
          0.8
        ]);
      }
    };
    if (map.isStyleLoaded()) update();
    else map.once("load", update);
  }, [selectedId, visibleEvents]);

  useEffect(() => {
    if (!selectedId) return;
    const event = events.find((candidate) => candidate.id === selectedId);
    if (!event || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [event.coordinates.longitude, event.coordinates.latitude],
      zoom: Math.max(mapRef.current.getZoom(), 3.4),
      duration: 1100,
      essential: true
    });
  }, [events, selectedId]);

  const zoom = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 320 });
  };

  const recenter = () => {
    mapRef.current?.flyTo({
      center: [8, 18],
      zoom: 1.45,
      bearing: 0,
      pitch: 0,
      duration: 900,
      essential: true
    });
  };

  const toggleProjection = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = projection === "globe" ? "mercator" : "globe";
    map.setProjection({ type: next });
    setProjection(next);
  };

  return (
    <div className="map-shell">
      <div ref={containerRef} className="map-canvas" data-testid="earth-map" />
      <div className="map-vignette" aria-hidden="true" />
      {mapError ? (
        <div className="map-unavailable" role="status">
          <Globe2 size={28} />
          <strong>3D globe unavailable</strong>
          <span>Event signals remain available in the intelligence feed.</span>
        </div>
      ) : null}
      <div className="map-tools" aria-label="Map controls">
        <button type="button" onClick={() => zoom(1)} aria-label="Zoom in">
          <Plus size={16} />
        </button>
        <button type="button" onClick={() => zoom(-1)} aria-label="Zoom out">
          <Minus size={16} />
        </button>
        <span />
        <button type="button" onClick={recenter} aria-label="Reset globe view">
          <Focus size={16} />
        </button>
        <button
          type="button"
          onClick={toggleProjection}
          aria-label={`Switch to ${projection === "globe" ? "flat map" : "globe"}`}
          title={`Switch to ${projection === "globe" ? "flat map" : "globe"}`}
        >
          {projection === "globe" ? <MapIcon size={16} /> : <Globe2 size={16} />}
        </button>
      </div>
      <div className="map-coordinate-label" aria-hidden="true">
        LIVE EARTH OBSERVATION · 3D
      </div>
    </div>
  );
}
