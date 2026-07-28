import {
  airQualityCategory,
  type AirQualityContext,
  type EarthEvent,
  type InfrastructureContext,
  type WeatherContext
} from "@terra-pulse/earth-domain";
import { fetchSourceJson } from "../collectors/shared";

interface ForecastPayload {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    precipitation?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    weather_code?: number;
  };
}

interface AirPayload {
  current?: {
    time?: string;
    us_aqi?: number;
    pm2_5?: number;
  };
}

interface OverpassPayload {
  elements?: Array<{
    tags?: {
      total?: string;
    };
  }>;
}

function coordinateKey(event: EarthEvent): string {
  return `${event.coordinates.latitude.toFixed(2)}:${event.coordinates.longitude.toFixed(2)}`;
}

async function weatherFor(env: Env, event: EarthEvent): Promise<WeatherContext> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", event.coordinates.latitude.toFixed(3));
  url.searchParams.set("longitude", event.coordinates.longitude.toFixed(3));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,precipitation,wind_speed_10m,wind_direction_10m,weather_code"
  );
  url.searchParams.set("forecast_days", "1");
  try {
    const response = await fetchSourceJson<ForecastPayload>(
      env,
      url.toString(),
      {
        cacheKey: `context:weather:${coordinateKey(event)}`,
        ttlSeconds: 900
      }
    );
    const current = response.data.current;
    if (!current) return { available: false };
    return {
      available: true,
      ...(typeof current.temperature_2m === "number"
        ? { temperatureC: current.temperature_2m }
        : {}),
      ...(typeof current.apparent_temperature === "number"
        ? { apparentTemperatureC: current.apparent_temperature }
        : {}),
      ...(typeof current.precipitation === "number"
        ? { precipitationMm: current.precipitation }
        : {}),
      ...(typeof current.wind_speed_10m === "number"
        ? { windSpeedKph: current.wind_speed_10m }
        : {}),
      ...(typeof current.wind_direction_10m === "number"
        ? { windDirectionDegrees: current.wind_direction_10m }
        : {}),
      ...(typeof current.weather_code === "number"
        ? { weatherCode: current.weather_code }
        : {}),
      ...(typeof current.time === "string" ? { observedAt: current.time } : {})
    };
  } catch {
    return { available: false };
  }
}

async function airQualityFor(
  env: Env,
  event: EarthEvent
): Promise<AirQualityContext> {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", event.coordinates.latitude.toFixed(3));
  url.searchParams.set("longitude", event.coordinates.longitude.toFixed(3));
  url.searchParams.set("current", "us_aqi,pm2_5");
  try {
    const response = await fetchSourceJson<AirPayload>(env, url.toString(), {
      cacheKey: `context:air:${coordinateKey(event)}`,
      ttlSeconds: 1800
    });
    const current = response.data.current;
    if (!current) return { available: false };
    return {
      available: true,
      ...(typeof current.us_aqi === "number" ? { usAqi: current.us_aqi } : {}),
      ...(typeof current.pm2_5 === "number" ? { pm25: current.pm2_5 } : {}),
      ...(typeof current.us_aqi === "number"
        ? { category: airQualityCategory(current.us_aqi) }
        : {}),
      ...(typeof current.time === "string" ? { observedAt: current.time } : {})
    };
  } catch {
    return { available: false };
  }
}

async function infrastructureFor(
  env: Env,
  event: EarthEvent
): Promise<InfrastructureContext> {
  const radiusKm = 50;
  const cacheKey = `context:hospitals:${coordinateKey(event)}`;
  const cached = await env.EARTH_CACHE.get(cacheKey, "json");
  if (
    cached &&
    typeof cached === "object" &&
    "hospitalCount" in cached &&
    typeof cached.hospitalCount === "number"
  ) {
    return {
      available: true,
      radiusKm,
      hospitalCount: cached.hospitalCount,
      method:
        "Count of OpenStreetMap features tagged amenity=hospital; map coverage and tagging completeness vary."
    };
  }
  const query = `[out:json][timeout:8];nwr["amenity"="hospital"](around:${radiusKm * 1000},${event.coordinates.latitude},${event.coordinates.longitude});out count;`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("Infrastructure request timed out"), 9_000);
  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "TerraPulse/0.1 (public Earth intelligence dashboard)"
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
    const payload = (await response.json()) as OverpassPayload;
    const count = Number(payload.elements?.[0]?.tags?.total ?? "NaN");
    if (!Number.isFinite(count)) throw new Error("Overpass count was unavailable");
    await env.EARTH_CACHE.put(cacheKey, JSON.stringify({ hospitalCount: count }), {
      expirationTtl: 21_600
    });
    return {
      available: true,
      radiusKm,
      hospitalCount: count,
      method:
        "Count of OpenStreetMap features tagged amenity=hospital; map coverage and tagging completeness vary."
    };
  } catch {
    return {
      available: false,
      radiusKm,
      method:
        "OpenStreetMap hospital coverage could not be retrieved; no count is inferred."
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function contextForEvent(
  env: Env,
  event: EarthEvent
): Promise<{
  weather: WeatherContext;
  airQuality: AirQualityContext;
  infrastructure: InfrastructureContext;
}> {
  const [weather, airQuality, infrastructure] = await Promise.all([
    weatherFor(env, event),
    airQualityFor(env, event),
    infrastructureFor(env, event)
  ]);
  return { weather, airQuality, infrastructure };
}
