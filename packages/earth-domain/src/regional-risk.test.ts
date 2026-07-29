import { describe, expect, it } from "vitest";
import { analyzeRegionalRisk } from "./index";
import type { EarthEvent } from "./types";

function event(
  id: string,
  latitude: number,
  longitude: number,
  location: string,
  riskScore = 56,
  type: EarthEvent["type"] = "wildfire"
): EarthEvent {
  return {
    id,
    type,
    title: `Signal ${id}`,
    location,
    coordinates: { latitude, longitude },
    observedAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-07-28T11:00:00.000Z",
    status: "open",
    riskScore,
    riskLevel: "moderate",
    source: {
      id: "test",
      name: "Test source",
      url: "https://example.com",
      retrievedAt: "2026-07-28T11:00:00.000Z"
    },
    metadata: {}
  };
}

describe("regional risk analysis", () => {
  it("ranks geographic concentrations deterministically", () => {
    const events = [
      event("ca-1", 38.5, -121.5, "Fire One, California"),
      event("ca-2", 39.1, -120.9, "Fire Two, California"),
      event("ca-3", 37.9, -122.1, "Fire Three, California"),
      event("az-1", 34.2, -111.8, "Fire Four, Arizona"),
      event("quake", 38.2, -121.8, "Quake, California", 90, "earthquake")
    ];

    const analysis = analyzeRegionalRisk(events, {
      eventType: "wildfire",
      generatedAt: "2026-07-28T12:00:00.000Z"
    });

    expect(analysis.analyzedEventCount).toBe(4);
    expect(analysis.regions[0]).toMatchObject({
      label: "California area",
      eventCount: 3,
      meanEventRiskScore: 56,
      score: 66
    });
    expect(analysis.regions[1]).toMatchObject({
      eventCount: 1,
      score: 56
    });
    expect(analysis.regions[0]!.examples.map(({ id }) => id)).toEqual([
      "ca-1",
      "ca-2",
      "ca-3"
    ]);
  });

  it("does not treat the computed score as a forecast", () => {
    const analysis = analyzeRegionalRisk(
      [event("one", 40, -120, "Fire One, Nevada")],
      { generatedAt: "2026-07-28T12:00:00.000Z" }
    );
    expect(analysis.limitations[0]).toContain("not a hazard probability or forecast");
  });

  it("gives separate clusters in the same region distinct labels", () => {
    const analysis = analyzeRegionalRisk(
      [
        event("north-a", 45.5, -122.4, "North Fork Fire, Oregon"),
        event("north-b", 45.6, -122.3, "Timber Fire, Oregon"),
        event("south-a", 42, -122.4, "Rogue Fire, Oregon"),
        event("south-b", 42.1, -122.3, "Valley Fire, Oregon")
      ],
      {
        eventType: "wildfire",
        clusterRadiusKm: 250,
        generatedAt: "2026-07-28T12:00:00.000Z"
      }
    );

    expect(analysis.regions.map(({ label }) => label)).toEqual([
      "Oregon near North Fork Fire",
      "Oregon near Rogue Fire"
    ]);
  });

  it("names cross-boundary clusters with both leading regions", () => {
    const analysis = analyzeRegionalRisk(
      [
        event("or-a", 45.5, -122.5, "River Fire, Oregon"),
        event("or-b", 45.6, -122.4, "Forest Fire, Oregon"),
        event("wa-a", 46, -122.3, "Ridge Fire, Washington")
      ],
      {
        eventType: "wildfire",
        generatedAt: "2026-07-28T12:00:00.000Z"
      }
    );

    expect(analysis.regions[0]?.label).toBe("Oregon–Washington area");
  });
});
