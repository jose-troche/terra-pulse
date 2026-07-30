import {
  riskLevelFor,
  validCoordinates,
  type EarthEvent
} from "@terra-pulse/earth-domain";
import {
  fetchSourceJson,
  firstCoordinate,
  type CollectedPayload
} from "./shared";

const GDACS_EVENTS_URL =
  "https://www.gdacs.org/gdacsapi/api/events/geteventlist/events4app";
const RECENT_UPDATE_DAYS = 21;

interface GdacsFeature {
  geometry?: {
    coordinates?: unknown;
  };
  properties?: {
    eventtype?: unknown;
    eventid?: unknown;
    eventname?: unknown;
    name?: unknown;
    description?: unknown;
    alertlevel?: unknown;
    country?: unknown;
    fromdate?: unknown;
    todate?: unknown;
    datemodified?: unknown;
    url?: {
      report?: unknown;
    };
    severitydata?: {
      severity?: unknown;
      severitytext?: unknown;
      severityunit?: unknown;
    };
  };
}

interface GdacsFeed {
  features?: unknown;
}

function gdacsRiskScore(alertLevel: string): number {
  const value = alertLevel.toLowerCase();
  if (value === "red") return 86;
  if (value === "orange") return 68;
  return 45;
}

export function normalizeGdacsDroughts(
  payload: GdacsFeed,
  retrievedAt: string
): EarthEvent[] {
  if (!Array.isArray(payload.features)) return [];
  const cutoff = Date.parse(retrievedAt) - RECENT_UPDATE_DAYS * 86_400_000;
  const seen = new Set<string>();
  const events: EarthEvent[] = [];
  for (const feature of payload.features as GdacsFeature[]) {
    const properties = feature.properties;
    if (!properties || properties.eventtype !== "DR") continue;
    const eventId =
      typeof properties.eventid === "number" ||
      typeof properties.eventid === "string"
        ? String(properties.eventid)
        : undefined;
    if (!eventId || seen.has(eventId)) continue;
    const updatedAt =
      typeof properties.datemodified === "string"
        ? properties.datemodified
        : typeof properties.todate === "string"
          ? properties.todate
          : retrievedAt;
    const updatedTime = Date.parse(updatedAt);
    if (!Number.isFinite(updatedTime) || updatedTime < cutoff) continue;
    const coordinate = firstCoordinate(feature.geometry?.coordinates);
    if (!coordinate) continue;
    const point = { longitude: coordinate[0], latitude: coordinate[1] };
    if (!validCoordinates(point)) continue;
    seen.add(eventId);
    const alertLevel =
      typeof properties.alertlevel === "string"
        ? properties.alertlevel
        : "Green";
    const riskScore = gdacsRiskScore(alertLevel);
    const country =
      typeof properties.country === "string" && properties.country
        ? properties.country
        : "Affected region";
    const name =
      typeof properties.name === "string"
        ? properties.name
        : typeof properties.description === "string"
          ? properties.description
          : `Drought in ${country}`;
    const severity = properties.severitydata?.severity;
    events.push({
      id: `gdacs:DR:${eventId}`,
      type: "climate",
      title: name,
      location: country,
      coordinates: point,
      observedAt:
        typeof properties.fromdate === "string"
          ? properties.fromdate
          : updatedAt,
      updatedAt,
      status: "open",
      severity: {
        value: typeof severity === "number" ? severity : riskScore,
        unit:
          typeof properties.severitydata?.severityunit === "string"
            ? properties.severitydata.severityunit
            : "priority",
        label:
          typeof properties.severitydata?.severitytext === "string"
            ? properties.severitydata.severitytext
            : `${alertLevel} GDACS drought alert`
      },
      riskScore,
      riskLevel: riskLevelFor(riskScore),
      description:
        typeof properties.severitydata?.severitytext === "string"
          ? properties.severitydata.severitytext
          : `${alertLevel} drought alert reported by GDACS.`,
      source: {
        id: "gdacs",
        name: "Global Disaster Alert and Coordination System (GDACS)",
        url:
          typeof properties.url?.report === "string"
            ? properties.url.report
            : GDACS_EVENTS_URL,
        retrievedAt
      },
      metadata: {
        category: "Drought"
      }
    });
  }
  return events;
}

export async function collectGdacsDroughts(
  env: Env
): Promise<CollectedPayload<EarthEvent[]>> {
  const response = await fetchSourceJson<GdacsFeed>(
    env,
    GDACS_EVENTS_URL,
    {
      cacheKey: "source:gdacs:drought:events4app:v1",
      ttlSeconds: 1800,
      timeoutMs: 15_000
    }
  );
  return {
    ...response,
    data: normalizeGdacsDroughts(response.data, response.retrievedAt)
  };
}
