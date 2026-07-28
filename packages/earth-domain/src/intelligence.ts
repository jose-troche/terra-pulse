import { referenceCities } from "./cities";
import { haversineKm } from "./geo";
import type {
  AirQualityContext,
  Confidence,
  EarthEvent,
  EventDetailResponse,
  EventListResponse,
  EvidenceItem,
  InfrastructureContext,
  IntelligenceBrief,
  PopulationContext,
  TimelineEntry,
  WeatherContext
} from "./types";

export function nearbyPopulation(
  event: EarthEvent,
  radiusKm = 250
): PopulationContext {
  const nearbyPlaces = referenceCities
    .map((city) => ({
      name: city.name,
      country: city.country,
      population: city.population,
      distanceKm: haversineKm(event.coordinates, city)
    }))
    .filter((city) => city.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 6)
    .map((city) => ({ ...city, distanceKm: Math.round(city.distanceKm) }));
  const representedPopulation = nearbyPlaces.reduce(
    (total, city) => total + city.population,
    0
  );
  return {
    radiusKm,
    nearbyPlaces,
    representedPopulation,
    label:
      representedPopulation > 0
        ? "Reference-city population nearby"
        : "No reference city within radius",
    method:
      "Great-circle proximity to a curated major-city reference set. This is context, not a confirmed exposure count."
  };
}

export function airQualityCategory(aqi: number | undefined): string | undefined {
  if (aqi === undefined) return undefined;
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for sensitive groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very unhealthy";
  return "Hazardous";
}

function describeWeather(weather: WeatherContext): string {
  if (!weather.available) {
    return "Current point weather is unavailable, so response conditions remain unknown.";
  }
  const pieces: string[] = [];
  if (weather.windSpeedKph !== undefined) {
    pieces.push(`${Math.round(weather.windSpeedKph)} km/h wind`);
  }
  if (weather.precipitationMm !== undefined) {
    pieces.push(`${weather.precipitationMm.toFixed(1)} mm precipitation`);
  }
  if (weather.temperatureC !== undefined) {
    pieces.push(`${Math.round(weather.temperatureC)}°C`);
  }
  return pieces.length > 0
    ? `Point conditions currently show ${pieces.join(", ")}.`
    : "Current point weather contains no usable measurements.";
}

function consequence(event: EarthEvent, weather: WeatherContext): string {
  if (
    event.type === "wildfire" &&
    weather.available &&
    (weather.windSpeedKph ?? 0) >= 25
  ) {
    return "Elevated wind overlaps the active fire signal. Faster spread and downwind smoke are plausible monitoring concerns, not confirmed outcomes.";
  }
  if (event.type === "earthquake" && event.metadata.tsunami) {
    return "The source marks a tsunami indicator. Follow official coastal advisories; this dashboard does not establish wave impact.";
  }
  if (event.type === "storm" || event.type === "flood") {
    return "Conditions may change as alerts and forecasts update. Monitor official warnings, transport disruption, and any verified humanitarian reports.";
  }
  return "The event may evolve as agencies publish new observations. Impact remains unconfirmed until authoritative reports are available.";
}

export function buildDeterministicBrief(
  event: EarthEvent,
  weather: WeatherContext,
  population: PopulationContext,
  infrastructure: InfrastructureContext,
  generatedAt = new Date().toISOString()
): IntelligenceBrief {
  const severity = event.severity
    ? `${event.severity.label} (${event.severity.value}${event.severity.unit ? ` ${event.severity.unit}` : ""})`
    : "an active signal";
  const nearest = population.nearbyPlaces[0];
  const nearbyContext = nearest
    ? `${nearest.name} is the nearest represented major city, approximately ${nearest.distanceKm} km away.`
    : "No major city in the reference set is within 250 km.";
  const infrastructureText = infrastructure.available
    ? `${infrastructure.hospitalCount ?? 0} mapped hospital features were found within ${infrastructure.radiusKm} km.`
    : "Nearby hospital coverage is unavailable.";
  const confidence: Confidence =
    event.source.id === "fallback"
      ? "low"
      : weather.available && population.nearbyPlaces.length > 0
        ? "high"
        : "medium";
  return {
    headline: event.title,
    whatHappened: `${event.source.name} reports ${severity} near ${event.location}. The event is assessed at ${event.riskLevel} monitoring priority from source severity and event characteristics.`,
    whyItMatters: `${nearbyContext} ${infrastructureText} ${describeWeather(weather)}`,
    whatCouldHappenNext: consequence(event, weather),
    limitations: [
      "Risk is a monitoring priority, not a prediction of damage or casualties.",
      "Population proximity is not confirmed exposure.",
      "Forecast and proximity signals are context, not proof of impact."
    ],
    confidence,
    generatedBy: "rules",
    generatedAt
  };
}

export function buildEvidence(
  event: EarthEvent,
  weather: WeatherContext,
  airQuality: AirQualityContext,
  population: PopulationContext,
  infrastructure: InfrastructureContext
): EvidenceItem[] {
  const evidence: EvidenceItem[] = [
    {
      id: `${event.id}:source`,
      classification: "observed",
      label: "Agency event record",
      value: event.severity
        ? `${event.severity.label}; ${event.location}`
        : `${event.type}; ${event.location}`,
      sourceName: event.source.name,
      sourceUrl: event.source.url,
      confidence: "high",
      observedAt: event.observedAt
    },
    {
      id: `${event.id}:risk`,
      classification: "computed",
      label: "Monitoring priority",
      value: `${event.riskLevel} · ${event.riskScore}/100`,
      method: "Deterministic rules combine event type, source severity, depth, and tsunami indicators where available.",
      confidence: "medium",
      observedAt: event.updatedAt
    },
    {
      id: `${event.id}:population`,
      classification: "computed",
      label: population.label,
      value:
        population.representedPopulation > 0
          ? `${population.representedPopulation.toLocaleString("en-US")} people represented within ${population.radiusKm} km`
          : `No represented major city within ${population.radiusKm} km`,
      method: population.method,
      confidence: "low",
      observedAt: event.updatedAt
    }
  ];
  if (weather.available) {
    evidence.push({
      id: `${event.id}:weather`,
      classification: "observed",
      label: "Point weather",
      value: describeWeather(weather).replace(/\.$/, ""),
      sourceName: "Open-Meteo",
      sourceUrl: "https://open-meteo.com/",
      confidence: "medium",
      observedAt: weather.observedAt ?? event.updatedAt
    });
  } else {
    evidence.push({
      id: `${event.id}:weather-unknown`,
      classification: "unknown",
      label: "Point weather",
      value: "Current conditions unavailable",
      confidence: "low",
      observedAt: event.updatedAt
    });
  }
  if (airQuality.available) {
    evidence.push({
      id: `${event.id}:air`,
      classification: "observed",
      label: "Air quality",
      value: `US AQI ${airQuality.usAqi ?? "n/a"} · ${airQuality.category ?? "Unclassified"}`,
      sourceName: "Open-Meteo",
      sourceUrl: "https://open-meteo.com/en/docs/air-quality-api",
      confidence: "medium",
      observedAt: airQuality.observedAt ?? event.updatedAt
    });
  }
  evidence.push({
    id: `${event.id}:infrastructure`,
    classification: infrastructure.available ? "computed" : "unknown",
    label: "Nearby hospitals",
    value: infrastructure.available
      ? `${infrastructure.hospitalCount ?? 0} mapped features within ${infrastructure.radiusKm} km`
      : "Coverage unavailable",
    method: infrastructure.method,
    confidence: infrastructure.available ? "low" : "low",
    observedAt: event.updatedAt
  });
  evidence.push({
    id: `${event.id}:impact-unknown`,
    classification: "unknown",
    label: "Confirmed human impact",
    value: "No verified damage, casualty, displacement, or response data is included.",
    confidence: "high",
    observedAt: event.updatedAt
  });
  return evidence;
}

export function buildTimeline(
  event: EarthEvent,
  weather: WeatherContext,
  infrastructure: InfrastructureContext,
  history: TimelineEntry[] = []
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    {
      id: `${event.id}:detected`,
      at: event.observedAt,
      title: "Event detected",
      description: `${event.source.name} published the source observation.`,
      classification: "observed"
    },
    {
      id: `${event.id}:normalized`,
      at: event.updatedAt,
      title: "Signal normalized",
      description: "Terra Pulse mapped the source record into the shared Earth event model.",
      classification: "computed"
    },
    ...history
  ];
  if (weather.available) {
    entries.push({
      id: `${event.id}:weather-context`,
      at: weather.observedAt ?? event.updatedAt,
      title: "Weather context connected",
      description: "Point conditions were attached from Open-Meteo.",
      classification: "observed"
    });
  }
  if (infrastructure.available) {
    entries.push({
      id: `${event.id}:infrastructure-context`,
      at: event.updatedAt,
      title: "Infrastructure proximity calculated",
      description: "Nearby mapped hospital features were counted from OpenStreetMap.",
      classification: "computed"
    });
  }
  return entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export function buildGraph(
  event: EarthEvent,
  weather: WeatherContext,
  population: PopulationContext,
  infrastructure: InfrastructureContext
): EventDetailResponse["graph"] {
  const nodes: EventDetailResponse["graph"]["nodes"] = [
    { id: event.id, label: event.title, kind: "event" },
    { id: `source:${event.source.id}`, label: event.source.name, kind: "source" },
    { id: `place:${event.location}`, label: event.location, kind: "place" }
  ];
  const edges: EventDetailResponse["graph"]["edges"] = [
    {
      from: `source:${event.source.id}`,
      to: event.id,
      relationship: "reported",
      classification: "observed"
    },
    {
      from: event.id,
      to: `place:${event.location}`,
      relationship: "located near",
      classification: "observed"
    }
  ];
  for (const place of population.nearbyPlaces.slice(0, 3)) {
    const id = `place:${place.name}`;
    nodes.push({ id, label: place.name, kind: "place" });
    edges.push({
      from: event.id,
      to: id,
      relationship: `${place.distanceKm} km from`,
      classification: "computed"
    });
  }
  if (weather.available) {
    nodes.push({ id: "weather:point", label: "Current weather", kind: "weather" });
    edges.push({
      from: "weather:point",
      to: event.id,
      relationship: "conditions at location",
      classification: "observed"
    });
  }
  if (infrastructure.available) {
    nodes.push({
      id: "infrastructure:hospitals",
      label: "Mapped hospitals",
      kind: "infrastructure"
    });
    edges.push({
      from: event.id,
      to: "infrastructure:hospitals",
      relationship: `within ${infrastructure.radiusKm} km`,
      classification: "computed"
    });
  }
  return { nodes, edges };
}

export function summarizeEarth(events: EarthEvent[]): EventListResponse["status"] {
  const byType: EventListResponse["status"]["byType"] = {
    earthquake: 0,
    wildfire: 0,
    storm: 0,
    flood: 0,
    volcano: 0,
    air_quality: 0,
    climate: 0
  };
  let critical = 0;
  let high = 0;
  for (const event of events) {
    byType[event.type] += 1;
    if (event.riskLevel === "critical") critical += 1;
    if (event.riskLevel === "high") high += 1;
  }
  return {
    totalActive: events.length,
    critical,
    high,
    trend: "stable",
    byType
  };
}
