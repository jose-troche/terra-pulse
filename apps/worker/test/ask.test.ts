import { describe, expect, it } from "vitest";
import type {
  EarthEvent,
  EventListResponse
} from "@terra-pulse/earth-domain";
import { deterministicAnswer } from "../src/services/ask";

function wildfire(
  id: string,
  latitude: number,
  longitude: number
): EarthEvent {
  return {
    id,
    type: "wildfire",
    title: `Wildfire ${id}`,
    location: `Wildfire ${id}, Oregon`,
    coordinates: { latitude, longitude },
    observedAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-07-28T11:00:00.000Z",
    status: "open",
    riskScore: 56,
    riskLevel: "moderate",
    source: {
      id: "eonet",
      name: "NASA EONET",
      url: "https://eonet.gsfc.nasa.gov/",
      retrievedAt: "2026-07-28T11:00:00.000Z"
    },
    metadata: { category: "Wildfires" }
  };
}

describe("Ask Earth deterministic analysis", () => {
  it("computes regional wildfire priorities before AI explanation", () => {
    const events = [
      wildfire("one", 44.1, -121.2),
      wildfire("two", 44.8, -120.7),
      wildfire("three", 43.9, -122)
    ];
    const overview: EventListResponse = {
      events,
      status: {
        totalActive: 3,
        critical: 0,
        high: 0,
        trend: "stable",
        byType: {
          earthquake: 0,
          wildfire: 3,
          storm: 0,
          flood: 0,
          volcano: 0,
          air_quality: 0,
          climate: 0
        }
      },
      sources: [
        {
          id: "eonet",
          name: "NASA EONET",
          state: "live",
          eventCount: 3,
          retrievedAt: "2026-07-28T11:00:00.000Z"
        }
      ],
      generatedAt: "2026-07-28T12:00:00.000Z",
      degraded: false
    };

    const result = deterministicAnswer(
      "Which areas show elevated wildfire risk?",
      overview,
      "test-session"
    );

    expect(result.response.classification).toBe("computed");
    expect(result.response.answer).toContain("deterministic 350 km");
    expect(result.response.answer).toContain("Oregon area");
    expect(result.response.answer).toContain("3 active signals");
    expect(result.regionalRisk?.regions[0]).toMatchObject({
      label: "Oregon area",
      eventCount: 3,
      score: 66
    });
  });
});
