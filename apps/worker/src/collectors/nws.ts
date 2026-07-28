import {
  categoricalRiskScore,
  riskLevelFor,
  validCoordinates,
  type EarthEvent,
  type EventType
} from "@terra-pulse/earth-domain";
import {
  fetchSourceJson,
  firstCoordinate,
  type CollectedPayload
} from "./shared";

const NWS_URL = "https://api.weather.gov/alerts/active?status=actual";

interface NwsFeature {
  id?: unknown;
  geometry?: { coordinates?: unknown } | null;
  properties?: {
    id?: unknown;
    areaDesc?: unknown;
    event?: unknown;
    effective?: unknown;
    sent?: unknown;
    ends?: unknown;
    expires?: unknown;
    severity?: unknown;
    certainty?: unknown;
    urgency?: unknown;
    headline?: unknown;
    description?: unknown;
    web?: unknown;
    "@id"?: unknown;
  };
}

interface NwsFeed {
  features?: unknown;
}

type NwsEventType = Exclude<EventType, "earthquake" | "volcano">;

function eventType(value: string): NwsEventType | undefined {
  const normalized = value.toLowerCase();
  if (normalized.includes("flood")) return "flood";
  if (
    normalized.includes("hurricane") ||
    normalized.includes("tornado") ||
    normalized.includes("storm") ||
    normalized.includes("wind") ||
    normalized.includes("typhoon")
  ) {
    return "storm";
  }
  if (normalized.includes("fire") || normalized.includes("red flag")) {
    return "wildfire";
  }
  if (
    normalized.includes("air quality") ||
    normalized.includes("smoke")
  ) {
    return "air_quality";
  }
  if (
    normalized.includes("heat") ||
    normalized.includes("freeze") ||
    normalized.includes("cold")
  ) {
    return "climate";
  }
  return undefined;
}

export function normalizeNws(
  payload: NwsFeed,
  retrievedAt: string
): EarthEvent[] {
  if (!Array.isArray(payload.features)) return [];
  const events: EarthEvent[] = [];
  for (const raw of (payload.features as NwsFeature[]).slice(0, 80)) {
    const properties = raw.properties;
    const category =
      typeof properties?.event === "string" ? properties.event : "";
    const type = eventType(category);
    const coordinate = firstCoordinate(raw.geometry?.coordinates);
    if (!properties || !type || !coordinate) continue;
    const point = { longitude: coordinate[0], latitude: coordinate[1] };
    if (!validCoordinates(point)) continue;
    const observedAt =
      typeof properties.effective === "string"
        ? properties.effective
        : typeof properties.sent === "string"
          ? properties.sent
          : retrievedAt;
    const severity =
      typeof properties.severity === "string"
        ? properties.severity
        : "Unknown";
    const riskScore = categoricalRiskScore(type, severity);
    const id =
      typeof properties.id === "string"
        ? properties.id
        : typeof raw.id === "string"
          ? raw.id
          : `${category}:${observedAt}:${coordinate.join(",")}`;
    const location =
      typeof properties.areaDesc === "string"
        ? properties.areaDesc
        : "United States";
    events.push({
      id: `nws:${encodeURIComponent(id)}`,
      type,
      title:
        typeof properties.headline === "string"
          ? properties.headline
          : `${category} · ${location}`,
      location,
      coordinates: point,
      observedAt,
      updatedAt: observedAt,
      status: "open",
      severity: {
        value: riskScore,
        unit: "priority",
        label: `${severity} ${category}`.trim()
      },
      riskScore,
      riskLevel: riskLevelFor(riskScore),
      description:
        typeof properties.description === "string"
          ? properties.description.slice(0, 480)
          : category,
      source: {
        id: "nws",
        name: "NOAA / National Weather Service",
        url:
          typeof properties["@id"] === "string"
            ? properties["@id"]
            : typeof properties.web === "string"
              ? properties.web
              : NWS_URL,
        retrievedAt
      },
      metadata: {
        category,
        alertSeverity: severity,
        ...(typeof properties.urgency === "string"
          ? { alertUrgency: properties.urgency }
          : {}),
        ...(typeof properties.certainty === "string"
          ? { alertCertainty: properties.certainty }
          : {})
      }
    });
  }
  return events;
}

export async function collectNws(
  env: Env
): Promise<CollectedPayload<EarthEvent[]>> {
  const response = await fetchSourceJson<NwsFeed>(env, NWS_URL, {
    cacheKey: "source:nws:active:v1",
    ttlSeconds: 600
  });
  return {
    ...response,
    data: normalizeNws(response.data, response.retrievedAt)
  };
}
