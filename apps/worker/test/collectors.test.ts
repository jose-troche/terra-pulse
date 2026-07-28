import { describe, expect, it } from "vitest";
import { normalizeEonet } from "../src/collectors/eonet";
import { normalizeNws } from "../src/collectors/nws";
import { normalizeUsgs } from "../src/collectors/usgs";

const retrievedAt = "2026-07-28T12:00:00.000Z";

describe("source normalizers", () => {
  it("normalizes a USGS earthquake and computes its priority", () => {
    const events = normalizeUsgs(
      {
        features: [
          {
            id: "abc",
            properties: {
              mag: 7.1,
              place: "near Test City",
              time: Date.parse("2026-07-28T10:00:00Z"),
              updated: Date.parse("2026-07-28T10:05:00Z"),
              url: "https://example.com/quake",
              status: "reviewed",
              tsunami: 1,
              title: "M 7.1 - near Test City"
            },
            geometry: { coordinates: [140, 36, 18] }
          }
        ]
      },
      retrievedAt
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "earthquake",
      riskLevel: "critical",
      metadata: { tsunami: true, depthKm: 18 }
    });
  });

  it("accepts both current geometry and legacy geometries from EONET", () => {
    const current = normalizeEonet(
      {
        events: [
          {
            id: "fire-1",
            title: "Test Fire",
            categories: [{ title: "Wildfires" }],
            geometry: [
              {
                date: "2026-07-28T09:00:00Z",
                type: "Point",
                coordinates: [-120, 38]
              }
            ]
          }
        ]
      },
      retrievedAt
    );
    const legacy = normalizeEonet(
      {
        events: [
          {
            id: "volcano-1",
            title: "Test Volcano",
            categories: [{ title: "Volcanoes" }],
            geometries: [
              {
                date: "2026-07-28T08:00:00Z",
                type: "Point",
                coordinates: [110, -7]
              }
            ]
          }
        ]
      },
      retrievedAt
    );
    expect(current[0]?.type).toBe("wildfire");
    expect(legacy[0]?.type).toBe("volcano");
  });

  it("normalizes only actionable NWS categories with mapped geometry", () => {
    const events = normalizeNws(
      {
        features: [
          {
            id: "alert-1",
            geometry: {
              coordinates: [[[-80, 25], [-79, 25], [-79, 26], [-80, 25]]]
            },
            properties: {
              event: "Hurricane Warning",
              areaDesc: "Coastal test area",
              effective: "2026-07-28T11:00:00Z",
              severity: "Extreme",
              urgency: "Immediate",
              certainty: "Observed",
              headline: "Hurricane warning for test area",
              "@id": "https://api.weather.gov/alerts/alert-1"
            }
          }
        ]
      },
      retrievedAt
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "storm",
      riskLevel: "high",
      location: "Coastal test area"
    });
  });
});
