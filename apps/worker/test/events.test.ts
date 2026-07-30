import { describe, expect, it } from "vitest";
import type {
  EarthEvent,
  EventType
} from "@terra-pulse/earth-domain";
import { selectBalancedEvents } from "../src/services/events";

function event(id: string, type: EventType, riskScore: number): EarthEvent {
  return {
    id,
    type,
    title: id,
    location: "Test region",
    coordinates: { latitude: 0, longitude: 0 },
    observedAt: "2026-07-28T12:00:00.000Z",
    updatedAt: "2026-07-28T12:00:00.000Z",
    status: "open",
    riskScore,
    riskLevel: riskScore >= 62 ? "high" : "moderate",
    source: {
      id: "test",
      name: "Test source",
      url: "https://example.com",
      retrievedAt: "2026-07-28T12:00:00.000Z"
    },
    metadata: {}
  };
}

describe("default event selection", () => {
  it("reserves space for every available event layer", () => {
    const earthquakes = Array.from({ length: 30 }, (_, index) =>
      event(`earthquake-${index}`, "earthquake", 90 - index)
    );
    const minorityLayers: EventType[] = [
      "wildfire",
      "storm",
      "flood",
      "volcano",
      "air_quality",
      "climate"
    ];
    const selected = selectBalancedEvents(
      [
        ...earthquakes,
        ...minorityLayers.map((type, index) =>
          event(`${type}-1`, type, 50 - index)
        )
      ],
      12
    );
    expect(selected).toHaveLength(12);
    expect(new Set(selected.map((item) => item.type))).toEqual(
      new Set<EventType>([
        "earthquake",
        "wildfire",
        "storm",
        "flood",
        "volcano",
        "air_quality",
        "climate"
      ])
    );
  });
});
