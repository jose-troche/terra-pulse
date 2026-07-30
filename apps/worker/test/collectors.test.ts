import { describe, expect, it } from "vitest";
import { normalizeEonet } from "../src/collectors/eonet";
import { normalizeGdacsDroughts } from "../src/collectors/gdacs";
import { normalizeNws } from "../src/collectors/nws";
import { normalizeOpenMeteoAirQuality } from "../src/collectors/open-meteo-air";
import { normalizeUsgs } from "../src/collectors/usgs";
import { normalizeUsgsVolcanoes } from "../src/collectors/usgs-volcano";

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

  it("normalizes current USGS elevated volcano alerts", () => {
    const events = normalizeUsgsVolcanoes(
      [
        {
          volcano_name: "Great Sitkin",
          vnum: "311120",
          obs_fullname: "Alaska Volcano Observatory",
          sent_unixtime: Date.parse("2026-07-28T19:57:13Z") / 1000,
          color_code: "ORANGE",
          alert_level: "WATCH",
          notice_url: "https://example.com/notice"
        }
      ],
      [
        {
          volcano_name: "Great Sitkin",
          vnum: "311120",
          region: "Aleutians",
          latitude: 52.0765,
          longitude: -176.1109
        }
      ],
      retrievedAt
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "volcano",
      riskLevel: "high",
      location: "Aleutians",
      source: { id: "usgs-volcano" }
    });
  });

  it("promotes unhealthy CAMS air quality into transparent modeled events", () => {
    const events = normalizeOpenMeteoAirQuality(
      [
        {
          current: {
            time: "2026-07-28T12:00",
            us_aqi: 170,
            pm2_5: 122.9
          }
        },
        {
          current: {
            time: "2026-07-28T12:00",
            us_aqi: 48,
            pm2_5: 7
          }
        }
      ],
      [
        {
          name: "Jakarta",
          country: "Indonesia",
          latitude: -6.21,
          longitude: 106.85,
          population: 11_436_000
        },
        {
          name: "Tokyo",
          country: "Japan",
          latitude: 35.68,
          longitude: 139.69,
          population: 37_115_000
        }
      ],
      retrievedAt
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "air_quality",
      riskLevel: "high",
      location: "Jakarta, Indonesia",
      source: { id: "open-meteo-air" }
    });
    expect(events[0]?.description).toContain("modeled regional guidance");
  });

  it("normalizes recently updated GDACS drought centroids", () => {
    const events = normalizeGdacsDroughts(
      {
        features: [
          {
            geometry: { coordinates: [82.956, 48.012] },
            properties: {
              eventtype: "DR",
              eventid: 1027491,
              name: "Drought in Kazakhstan",
              country: "Kazakhstan",
              alertlevel: "Green",
              fromdate: "2026-05-01T00:00:00Z",
              datemodified: "2026-07-28T10:00:00Z",
              url: { report: "https://example.com/drought" },
              severitydata: {
                severity: 727014,
                severityunit: "km2",
                severitytext: "Minor agricultural drought impact"
              }
            }
          }
        ]
      },
      retrievedAt
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "climate",
      riskLevel: "moderate",
      source: { id: "gdacs" },
      severity: { unit: "km2" }
    });
  });
});
