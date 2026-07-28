import {
  riskLevelFor,
  type EarthEvent
} from "@terra-pulse/earth-domain";

export function fallbackEvents(now = new Date()): EarthEvent[] {
  const minutesAgo = (minutes: number): string =>
    new Date(now.getTime() - minutes * 60_000).toISOString();
  const sample = (
    id: string,
    event: Omit<EarthEvent, "id" | "riskLevel" | "source">
  ): EarthEvent => ({
    ...event,
    id: `fallback:${id}`,
    riskLevel: riskLevelFor(event.riskScore),
    source: {
      id: "fallback",
      name: "Terra Pulse demonstration data",
      url: "/about",
      retrievedAt: now.toISOString()
    }
  });
  return [
    sample("pacific-earthquake", {
      type: "earthquake",
      title: "Demonstration · M6.4 Pacific earthquake",
      location: "Northwest Pacific",
      coordinates: { latitude: 38.2, longitude: 142.1 },
      observedAt: minutesAgo(18),
      updatedAt: minutesAgo(12),
      status: "open",
      severity: { value: 6.4, unit: "M", label: "Magnitude 6.4" },
      riskScore: 74,
      description: "Demonstration record shown while live agencies are unavailable.",
      metadata: { depthKm: 28, tsunami: false }
    }),
    sample("alberta-fire", {
      type: "wildfire",
      title: "Demonstration · Active wildfire signal",
      location: "Alberta, Canada",
      coordinates: { latitude: 55.1, longitude: -116.5 },
      observedAt: minutesAgo(95),
      updatedAt: minutesAgo(35),
      status: "open",
      riskScore: 67,
      description: "Demonstration record shown while live agencies are unavailable.",
      metadata: { category: "Wildfires" }
    }),
    sample("atlantic-storm", {
      type: "storm",
      title: "Demonstration · Atlantic storm system",
      location: "Central Atlantic",
      coordinates: { latitude: 24.8, longitude: -52.3 },
      observedAt: minutesAgo(180),
      updatedAt: minutesAgo(42),
      status: "open",
      riskScore: 58,
      description: "Demonstration record shown while live agencies are unavailable.",
      metadata: { category: "Severe Storms" }
    }),
    sample("indonesia-volcano", {
      type: "volcano",
      title: "Demonstration · Volcanic activity",
      location: "East Java, Indonesia",
      coordinates: { latitude: -8.1, longitude: 112.9 },
      observedAt: minutesAgo(420),
      updatedAt: minutesAgo(75),
      status: "open",
      riskScore: 64,
      description: "Demonstration record shown while live agencies are unavailable.",
      metadata: { category: "Volcanoes" }
    })
  ];
}
