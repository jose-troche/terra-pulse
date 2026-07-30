import {
  referenceCities,
  riskLevelFor,
  type EarthEvent,
  type ReferenceCity
} from "@terra-pulse/earth-domain";
import { fetchSourceJson, type CollectedPayload } from "./shared";

const AIR_QUALITY_URL =
  "https://air-quality-api.open-meteo.com/v1/air-quality";
const AIR_QUALITY_DOCUMENTATION_URL =
  "https://open-meteo.com/en/docs/air-quality-api";

const monitoredCityNames = new Set([
  "Tokyo",
  "Delhi",
  "Shanghai",
  "Dhaka",
  "São Paulo",
  "Cairo",
  "Mexico City",
  "Beijing",
  "Mumbai",
  "Karachi",
  "Lagos",
  "Buenos Aires",
  "Manila",
  "Jakarta",
  "London",
  "Tehran",
  "New York",
  "Los Angeles",
  "Sydney",
  "Johannesburg",
  "Nairobi",
  "Santiago"
]);

const monitoredCities = referenceCities.filter((city) =>
  monitoredCityNames.has(city.name)
);

interface AirQualityLocation {
  current?: {
    time?: unknown;
    us_aqi?: unknown;
    pm2_5?: unknown;
  };
}

function airQualityLabel(aqi: number): string {
  if (aqi >= 301) return "Hazardous";
  if (aqi >= 201) return "Very unhealthy";
  if (aqi >= 151) return "Unhealthy";
  return "Unhealthy for sensitive groups";
}

function airQualityRiskScore(aqi: number): number {
  if (aqi >= 301) return 96;
  if (aqi >= 201) return 86;
  if (aqi >= 151) return 72;
  return 58;
}

function observedTime(value: unknown, retrievedAt: string): string {
  if (typeof value !== "string") return retrievedAt;
  const parsed = Date.parse(value.endsWith("Z") ? value : `${value}Z`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : retrievedAt;
}

function cityId(city: ReferenceCity): string {
  return city.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function normalizeOpenMeteoAirQuality(
  payload: AirQualityLocation | AirQualityLocation[],
  cities: ReferenceCity[],
  retrievedAt: string
): EarthEvent[] {
  const locations = Array.isArray(payload) ? payload : [payload];
  return locations.flatMap((location, index) => {
    const city = cities[index];
    const aqi = location.current?.us_aqi;
    if (!city || typeof aqi !== "number" || aqi < 101) return [];
    const pm25 = location.current?.pm2_5;
    const label = airQualityLabel(aqi);
    const riskScore = airQualityRiskScore(aqi);
    const observedAt = observedTime(location.current?.time, retrievedAt);
    return [
      {
        id: `open-meteo-air:${cityId(city)}`,
        type: "air_quality",
        title: `${label} air quality in ${city.name}`,
        location: `${city.name}, ${city.country}`,
        coordinates: {
          latitude: city.latitude,
          longitude: city.longitude
        },
        observedAt,
        updatedAt: observedAt,
        status: "open",
        severity: {
          value: Math.round(aqi),
          unit: "US AQI",
          label: `${label} · US AQI ${Math.round(aqi)}`
        },
        riskScore,
        riskLevel: riskLevelFor(riskScore),
        description: `CAMS model guidance reports US AQI ${Math.round(aqi)}${
          typeof pm25 === "number"
            ? ` and PM2.5 ${pm25.toFixed(1)} µg/m³`
            : ""
        } near ${city.name}. This is modeled regional guidance, not a local monitor reading.`,
        source: {
          id: "open-meteo-air",
          name: "Open-Meteo / Copernicus CAMS Air Quality",
          url: AIR_QUALITY_DOCUMENTATION_URL,
          retrievedAt
        },
        metadata: {
          category: "Modeled unhealthy air quality"
        }
      } satisfies EarthEvent
    ];
  });
}

export async function collectOpenMeteoAirQuality(
  env: Env
): Promise<CollectedPayload<EarthEvent[]>> {
  const url = new URL(AIR_QUALITY_URL);
  url.searchParams.set(
    "latitude",
    monitoredCities.map((city) => city.latitude).join(",")
  );
  url.searchParams.set(
    "longitude",
    monitoredCities.map((city) => city.longitude).join(",")
  );
  url.searchParams.set("current", "us_aqi,pm2_5");
  url.searchParams.set("timezone", "GMT");
  const response = await fetchSourceJson<
    AirQualityLocation | AirQualityLocation[]
  >(env, url.toString(), {
    cacheKey: "source:open-meteo-air:global-cities:v1",
    ttlSeconds: 1800
  });
  return {
    ...response,
    data: normalizeOpenMeteoAirQuality(
      response.data,
      monitoredCities,
      response.retrievedAt
    )
  };
}
