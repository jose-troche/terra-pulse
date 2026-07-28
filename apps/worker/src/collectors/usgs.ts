import {
  earthquakeRiskScore,
  riskLevelFor,
  validCoordinates,
  type EarthEvent
} from "@terra-pulse/earth-domain";
import { fetchSourceJson, type CollectedPayload } from "./shared";

const USGS_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";

interface UsgsFeature {
  id?: unknown;
  properties?: {
    mag?: unknown;
    place?: unknown;
    time?: unknown;
    updated?: unknown;
    url?: unknown;
    status?: unknown;
    tsunami?: unknown;
    title?: unknown;
  };
  geometry?: {
    coordinates?: unknown;
  };
}

interface UsgsFeed {
  features?: unknown;
}

export function normalizeUsgs(
  payload: UsgsFeed,
  retrievedAt: string
): EarthEvent[] {
  if (!Array.isArray(payload.features)) return [];
  const events: EarthEvent[] = [];
  for (const raw of payload.features as UsgsFeature[]) {
    const properties = raw.properties;
    const coordinates = raw.geometry?.coordinates;
    if (
      typeof raw.id !== "string" ||
      !properties ||
      !Array.isArray(coordinates) ||
      typeof coordinates[0] !== "number" ||
      typeof coordinates[1] !== "number" ||
      typeof properties.time !== "number"
    ) {
      continue;
    }
    const point = {
      longitude: coordinates[0],
      latitude: coordinates[1]
    };
    if (!validCoordinates(point)) continue;
    const magnitude =
      typeof properties.mag === "number" ? properties.mag : 0;
    const depthKm =
      typeof coordinates[2] === "number" ? coordinates[2] : undefined;
    const tsunami = properties.tsunami === 1;
    const riskScore = earthquakeRiskScore(magnitude, depthKm, tsunami);
    const location =
      typeof properties.place === "string"
        ? properties.place
        : "Unspecified location";
    const updated =
      typeof properties.updated === "number"
        ? properties.updated
        : properties.time;
    events.push({
      id: `usgs:${raw.id}`,
      type: "earthquake",
      title:
        typeof properties.title === "string"
          ? properties.title
          : `M ${magnitude.toFixed(1)} earthquake`,
      location,
      coordinates: point,
      observedAt: new Date(properties.time).toISOString(),
      updatedAt: new Date(updated).toISOString(),
      status: properties.status === "deleted" ? "closed" : "open",
      severity: {
        value: magnitude,
        unit: "M",
        label: `Magnitude ${magnitude.toFixed(1)}`
      },
      riskScore,
      riskLevel: riskLevelFor(riskScore),
      description: `${depthKm === undefined ? "Unknown" : Math.round(depthKm)} km depth${tsunami ? " · tsunami indicator" : ""}`,
      source: {
        id: "usgs",
        name: "USGS Earthquake Hazards Program",
        url:
          typeof properties.url === "string" ? properties.url : USGS_URL,
        retrievedAt
      },
      metadata: {
        ...(depthKm === undefined ? {} : { depthKm }),
        tsunami
      }
    });
  }
  return events;
}

export async function collectUsgs(
  env: Env
): Promise<CollectedPayload<EarthEvent[]>> {
  const response = await fetchSourceJson<UsgsFeed>(env, USGS_URL, {
    cacheKey: "source:usgs:all-day:v1",
    ttlSeconds: 300
  });
  return {
    ...response,
    data: normalizeUsgs(response.data, response.retrievedAt)
  };
}
