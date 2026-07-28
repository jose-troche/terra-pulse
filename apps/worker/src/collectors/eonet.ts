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

const EONET_URL =
  "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100&days=30";

interface EonetCategory {
  id?: unknown;
  title?: unknown;
}

interface EonetGeometry {
  date?: unknown;
  type?: unknown;
  coordinates?: unknown;
  magnitudeValue?: unknown;
  magnitudeUnit?: unknown;
}

interface EonetEvent {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  link?: unknown;
  categories?: unknown;
  geometry?: unknown;
  geometries?: unknown;
}

interface EonetFeed {
  events?: unknown;
}

type EonetEventType = Exclude<EventType, "earthquake">;

function mapCategory(category: string): EonetEventType | undefined {
  const value = category.toLowerCase();
  if (value.includes("wildfire")) return "wildfire";
  if (value.includes("storm")) return "storm";
  if (value.includes("flood")) return "flood";
  if (value.includes("volcano")) return "volcano";
  if (value.includes("dust") || value.includes("air")) return "air_quality";
  if (value.includes("sea") || value.includes("snow") || value.includes("ice")) {
    return "climate";
  }
  return undefined;
}

export function normalizeEonet(
  payload: EonetFeed,
  retrievedAt: string
): EarthEvent[] {
  if (!Array.isArray(payload.events)) return [];
  const events: EarthEvent[] = [];
  for (const raw of payload.events as EonetEvent[]) {
    const categories = Array.isArray(raw.categories)
      ? (raw.categories as EonetCategory[])
      : [];
    const category = categories.find((item) => typeof item.title === "string");
    const categoryTitle =
      typeof category?.title === "string" ? category.title : "Natural event";
    const type = mapCategory(categoryTitle);
    if (type === undefined || typeof raw.id !== "string") continue;
    const geometryCollection = Array.isArray(raw.geometry)
      ? (raw.geometry as EonetGeometry[])
      : Array.isArray(raw.geometries)
        ? (raw.geometries as EonetGeometry[])
        : [];
    const geometry = geometryCollection.at(-1);
    const coordinate = firstCoordinate(geometry?.coordinates);
    if (!coordinate) continue;
    const point = { longitude: coordinate[0], latitude: coordinate[1] };
    if (!validCoordinates(point)) continue;
    const observedAt =
      typeof geometry?.date === "string" ? geometry.date : retrievedAt;
    const magnitude =
      typeof geometry?.magnitudeValue === "number"
        ? geometry.magnitudeValue
        : undefined;
    const riskScore = categoricalRiskScore(type, categoryTitle);
    const title =
      typeof raw.title === "string" ? raw.title : `Active ${categoryTitle}`;
    events.push({
      id: `eonet:${raw.id}`,
      type,
      title,
      location: title,
      coordinates: point,
      observedAt,
      updatedAt: observedAt,
      status: "open",
      ...(magnitude === undefined
        ? {}
        : {
            severity: {
              value: magnitude,
              unit:
                typeof geometry?.magnitudeUnit === "string"
                  ? geometry.magnitudeUnit
                  : undefined,
              label: categoryTitle
            }
          }),
      riskScore,
      riskLevel: riskLevelFor(riskScore),
      description:
        typeof raw.description === "string" && raw.description.trim()
          ? raw.description
          : `${categoryTitle} observed by NASA EONET`,
      source: {
        id: "eonet",
        name: "NASA EONET",
        url: typeof raw.link === "string" ? raw.link : EONET_URL,
        retrievedAt
      },
      metadata: { category: categoryTitle }
    });
  }
  return events;
}

export async function collectEonet(
  env: Env
): Promise<CollectedPayload<EarthEvent[]>> {
  const response = await fetchSourceJson<EonetFeed>(env, EONET_URL, {
    cacheKey: "source:eonet:open:v3",
    ttlSeconds: 900
  });
  return {
    ...response,
    data: normalizeEonet(response.data, response.retrievedAt)
  };
}
