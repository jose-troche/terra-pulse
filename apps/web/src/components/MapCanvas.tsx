import { useEffect, useMemo, useRef, useState } from "react";
import {
  AttributionControl,
  Map,
  type ExpressionSpecification,
  type ErrorEvent,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type Map as MapLibreMap,
  setWorkerUrl,
  type StyleSpecification
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type {
  EarthEvent,
  EventType,
  ViewerLocation
} from "@terra-pulse/earth-domain";
import { Focus, Globe2, Map as MapIcon, Minus, Plus } from "lucide-react";
import { eventIconPaths, eventTypes } from "../lib/event-icons";
import { eventColors } from "../lib/format";

setWorkerUrl("/maplibre-gl-worker.mjs");

interface MapCanvasProps {
  events: EarthEvent[];
  activeTypes: Set<EventType>;
  selectedId?: string;
  viewerLocation?: ViewerLocation;
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
        "raster-saturation": -0.58,
        "raster-contrast": 0.3,
        "raster-brightness-min": 0.06,
        "raster-brightness-max": 0.56,
        "raster-opacity": 0.95
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

const toEventFeatureCollection = (events: EarthEvent[]) => ({
  type: "FeatureCollection" as const,
  features: events.map((event) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
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

const eventPacketKey = (events: EarthEvent[]) =>
  events.map((event) => `${event.id}:${event.updatedAt}`).join("|");

function eventIconImage(type: EventType): Promise<HTMLImageElement> {
  const paths = eventIconPaths[type]
    .map((path) => `<path d="${path}"/>`)
    .join("");
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f7fff9" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return new Promise((resolve, reject) => {
    const image = new Image(32, 32);
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${type} map icon.`));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  });
}

async function registerEventIcons(map: MapLibreMap): Promise<void> {
  const images = await Promise.all(
    eventTypes.map(async (type) => ({
      type,
      image: await eventIconImage(type)
    }))
  );
  for (const { type, image } of images) {
    const id = `event-icon-${type}`;
    if (!map.hasImage(id)) map.addImage(id, image);
  }
}

export function MapCanvas({
  events,
  activeTypes,
  selectedId,
  viewerLocation,
  onSelect
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const hasAutoFocusedRef = useRef(false);
  const lastAppliedPacketRef = useRef("");
  const visibleEventsRef = useRef<EarthEvent[]>([]);
  const [projection, setProjection] = useState<"globe" | "mercator">("globe");
  const [mapError, setMapError] = useState(false);
  const [signalsReady, setSignalsReady] = useState(false);
  const [iconsReady, setIconsReady] = useState(false);

  onSelectRef.current = onSelect;

  const visibleEvents = useMemo(
    () => events.filter((event) => activeTypes.has(event.type)),
    [activeTypes, events]
  );
  visibleEventsRef.current = visibleEvents;
  const viewerLocationLabel = viewerLocation
    ? [viewerLocation.city, viewerLocation.region ?? viewerLocation.country]
        .filter(Boolean)
        .join(", ")
    : "";

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    try {
      const map = new Map({
        container: containerRef.current,
        style: mapStyle,
        center: viewerLocation
          ? [
              viewerLocation.coordinates.longitude,
              viewerLocation.coordinates.latitude
            ]
          : [8, 18],
        zoom: viewerLocation ? 2.45 : 1.45,
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
        const initialEvents = visibleEventsRef.current;
        setSignalsReady(false);
        map.addSource("earth-events", {
          type: "geojson",
          data: toEventFeatureCollection(initialEvents)
        });
        lastAppliedPacketRef.current = eventPacketKey(initialEvents);
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
              12,
              100,
              32
            ],
            "circle-color": colorExpression,
            "circle-opacity": 0.28,
            "circle-blur": 0.42
          }
        });
        map.addLayer({
          id: "event-priority-ring",
          type: "circle",
          source: "earth-events",
          filter: [">=", ["get", "riskScore"], 65],
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "riskScore"],
              65,
              10,
              100,
              18
            ],
            "circle-color": colorExpression,
            "circle-opacity": 0.12,
            "circle-stroke-color": colorExpression,
            "circle-stroke-opacity": 0.82,
            "circle-stroke-width": 1.5
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
              5.5,
              100,
              11
            ],
            "circle-color": colorExpression,
            "circle-stroke-color": "rgba(239,255,248,.95)",
            "circle-stroke-width": [
              "case",
              ["==", ["get", "id"], selectedId ?? ""],
              3,
              1.4
            ],
            "circle-opacity": 1
          }
        });
        setSignalsReady(true);
        void registerEventIcons(map)
          .then(() => {
            if (!map.getSource("earth-events") || map.getLayer("event-icons")) {
              return;
            }
            map.addLayer({
              id: "event-icons",
              type: "symbol",
              source: "earth-events",
              layout: {
                "icon-image": [
                  "concat",
                  "event-icon-",
                  ["get", "type"]
                ],
                "icon-size": [
                  "interpolate",
                  ["linear"],
                  ["get", "riskScore"],
                  0,
                  0.36,
                  100,
                  0.62
                ],
                "icon-allow-overlap": true,
                "icon-ignore-placement": true
              }
            });
            setIconsReady(true);
          })
          .catch((error: unknown) => {
            console.warn(
              error instanceof Error
                ? error.message
                : "Could not load map event icons."
            );
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
      const packetKey = eventPacketKey(visibleEvents);
      if (source && packetKey !== lastAppliedPacketRef.current) {
        setSignalsReady(false);
        source.setData(toEventFeatureCollection(visibleEvents));
        lastAppliedPacketRef.current = packetKey;
        setSignalsReady(true);
      }
      if (map.getLayer("event-points")) {
        map.setPaintProperty("event-points", "circle-stroke-width", [
          "case",
          ["==", ["get", "id"], selectedId ?? ""],
          3,
          1.4
        ]);
      }
      map.triggerRepaint();
      if (!hasAutoFocusedRef.current && !selectedId) {
        const priorityEvent = [...visibleEvents].sort(
          (left, right) => right.riskScore - left.riskScore
        ).at(0);
        if (viewerLocation) {
          hasAutoFocusedRef.current = true;
          map.flyTo({
            center: [
              viewerLocation.coordinates.longitude,
              viewerLocation.coordinates.latitude
            ],
            zoom: 2.45,
            duration: 1100,
            essential: true
          });
        } else if (priorityEvent) {
          hasAutoFocusedRef.current = true;
          map.flyTo({
            center: [
              priorityEvent.coordinates.longitude,
              priorityEvent.coordinates.latitude
            ],
            zoom: 2.15,
            duration: 1100,
            essential: true
          });
        }
      }
    };
    if (map.isStyleLoaded()) update();
    else map.once("load", update);
  }, [selectedId, viewerLocation, visibleEvents]);

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
    const priorityEvent = [...visibleEvents].sort(
      (left, right) => right.riskScore - left.riskScore
    ).at(0);
    mapRef.current?.flyTo({
      center: viewerLocation
        ? [
            viewerLocation.coordinates.longitude,
            viewerLocation.coordinates.latitude
          ]
        : priorityEvent
        ? [
            priorityEvent.coordinates.longitude,
            priorityEvent.coordinates.latitude
          ]
        : [8, 18],
      zoom: viewerLocation ? 2.45 : priorityEvent ? 2.15 : 1.45,
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
    <div
      className="map-shell"
      data-starting-view={viewerLocation ? "viewer" : "priority"}
      data-event-icons={iconsReady ? "ready" : "loading"}
    >
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
      <div className="map-coordinate-label">
        {viewerLocation
          ? `STARTING NEAR ${viewerLocationLabel || "YOUR REGION"} · APPROXIMATE`
          : "LIVE EARTH OBSERVATION · 3D"}
      </div>
      <div className="map-signal-count" aria-live="polite">
        <span className="live-indicator" />
        {visibleEvents.length > 0 ? (
          <>
            <strong>{visibleEvents.length}</strong>{" "}
            {signalsReady ? "signals plotted" : "signals plotting…"}
          </>
        ) : (
          "No observation layers selected"
        )}
      </div>
    </div>
  );
}
