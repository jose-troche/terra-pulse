import { expect, test, type Page } from "@playwright/test";

const now = new Date().toISOString();

const eventsResponse = {
  events: [
    {
      id: "usgs:test-quake",
      type: "earthquake",
      title: "M 7.1 - near Sendai, Japan",
      location: "42 km east of Sendai, Japan",
      coordinates: { latitude: 38.3, longitude: 141.2 },
      observedAt: now,
      updatedAt: now,
      status: "open",
      severity: { value: 7.1, unit: "M", label: "Magnitude 7.1" },
      riskScore: 93,
      riskLevel: "critical",
      description: "18 km depth · tsunami indicator",
      source: {
        id: "usgs",
        name: "USGS Earthquake Hazards Program",
        url: "https://earthquake.usgs.gov/",
        retrievedAt: now
      },
      metadata: { depthKm: 18, tsunami: true }
    },
    {
      id: "eonet:test-fire",
      type: "wildfire",
      title: "Northwest Territories Wildfires",
      location: "Northwest Territories, Canada",
      coordinates: { latitude: 62.4, longitude: -114.4 },
      observedAt: now,
      updatedAt: now,
      status: "open",
      riskScore: 67,
      riskLevel: "high",
      description: "Wildfire observed by NASA EONET",
      source: {
        id: "eonet",
        name: "NASA EONET",
        url: "https://eonet.gsfc.nasa.gov/",
        retrievedAt: now
      },
      metadata: { category: "Wildfires" }
    },
    {
      id: "nws:test-storm",
      type: "storm",
      title: "Hurricane warning for coastal Florida",
      location: "Florida Atlantic Coast",
      coordinates: { latitude: 26.3, longitude: -79.8 },
      observedAt: now,
      updatedAt: now,
      status: "open",
      severity: { value: 74, unit: "priority", label: "Extreme hurricane warning" },
      riskScore: 74,
      riskLevel: "high",
      description: "Hurricane warning",
      source: {
        id: "nws",
        name: "NOAA / National Weather Service",
        url: "https://api.weather.gov/",
        retrievedAt: now
      },
      metadata: { category: "Hurricane Warning" }
    }
  ],
  status: {
    totalActive: 3,
    critical: 1,
    high: 2,
    trend: "stable",
    byType: {
      earthquake: 1,
      wildfire: 1,
      storm: 1,
      flood: 0,
      volcano: 0,
      air_quality: 0,
      climate: 0
    }
  },
  sources: [
    {
      id: "usgs",
      name: "USGS Earthquake Hazards Program",
      state: "live",
      eventCount: 1,
      retrievedAt: now
    },
    {
      id: "eonet",
      name: "NASA EONET",
      state: "cached",
      eventCount: 1,
      retrievedAt: now
    },
    {
      id: "nws",
      name: "NOAA / National Weather Service",
      state: "live",
      eventCount: 1,
      retrievedAt: now
    }
  ],
  generatedAt: now,
  degraded: false
};

const detailResponse = {
  event: eventsResponse.events[0],
  weather: {
    available: true,
    temperatureC: 24,
    apparentTemperatureC: 25,
    precipitationMm: 6.2,
    windSpeedKph: 32,
    windDirectionDegrees: 90,
    observedAt: now
  },
  airQuality: {
    available: true,
    usAqi: 48,
    pm25: 8,
    category: "Good",
    observedAt: now
  },
  population: {
    method: "Great-circle proximity to reference cities.",
    radiusKm: 250,
    nearbyPlaces: [
      {
        name: "Tokyo",
        country: "Japan",
        distanceKm: 217,
        population: 37_115_000
      }
    ],
    representedPopulation: 37_115_000,
    label: "Reference-city population nearby"
  },
  infrastructure: {
    available: true,
    radiusKm: 50,
    hospitalCount: 34,
    method: "Count of mapped hospital features."
  },
  evidence: [
    {
      id: "source",
      classification: "observed",
      label: "Agency event record",
      value: "Magnitude 7.1; near Sendai",
      sourceName: "USGS",
      sourceUrl: "https://earthquake.usgs.gov/",
      confidence: "high",
      observedAt: now
    },
    {
      id: "population",
      classification: "computed",
      label: "Reference-city population nearby",
      value: "37,115,000 people represented within 250 km",
      method: "Proximity context, not exposure.",
      confidence: "low",
      observedAt: now
    }
  ],
  brief: {
    headline: "M 7.1 earthquake near Sendai",
    whatHappened:
      "USGS reports a magnitude 7.1 earthquake near Sendai with a tsunami indicator.",
    whyItMatters:
      "A major reference city is within 250 km, mapped hospitals are nearby, and heavy rain may complicate response.",
    whatCouldHappenNext:
      "Follow official coastal advisories. Impact has not been confirmed.",
    limitations: [
      "Risk is a monitoring priority, not a prediction of damage or casualties.",
      "Population proximity is not confirmed exposure."
    ],
    confidence: "high",
    generatedBy: "rules",
    generatedAt: now
  },
  timeline: [
    {
      id: "detected",
      at: now,
      title: "Event detected",
      description: "USGS published the source observation.",
      classification: "observed"
    },
    {
      id: "weather",
      at: now,
      title: "Weather context connected",
      description: "Point conditions were attached from Open-Meteo.",
      classification: "observed"
    }
  ],
  graph: {
    nodes: [
      { id: "usgs:test-quake", label: "M 7.1 earthquake", kind: "event" },
      { id: "source:usgs", label: "USGS", kind: "source" },
      { id: "place:Tokyo", label: "Tokyo", kind: "place" }
    ],
    edges: [
      {
        from: "source:usgs",
        to: "usgs:test-quake",
        relationship: "reported",
        classification: "observed"
      },
      {
        from: "usgs:test-quake",
        to: "place:Tokyo",
        relationship: "217 km from",
        classification: "computed"
      }
    ]
  }
};

async function mockApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/events") {
      await route.fulfill({ json: eventsResponse });
      return;
    }
    if (pathname === "/api/events/usgs%3Atest-quake") {
      await route.fulfill({ json: detailResponse });
      return;
    }
    if (pathname === "/api/ask") {
      await route.fulfill({
        json: {
          answer:
            "The current packet shows one critical earthquake and two high-priority weather or fire signals.",
          classification: "observed",
          confidence: "high",
          citations: [{ label: "USGS" }, { label: "NASA EONET" }],
          sessionId: "test-session-123",
          generatedBy: "rules",
          limitations: ["Limited to the current source packet."]
        }
      });
      return;
    }
    await route.fulfill({
      status: 404,
      json: { error: "Not found" }
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("renders the live Earth dashboard and filters layers", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /What is happening/ })
  ).toBeVisible();
  await expect(page.getByText("M 7.1 - near Sendai, Japan")).toBeVisible();
  await expect(page.getByText("Northwest Territories Wildfires")).toBeVisible();
  await expect(page.getByText("Active signals").first()).toBeVisible();
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible();

  const menu = page.getByRole("button", { name: "Open layer controls" });
  if (await menu.isVisible()) await menu.click();
  await page.getByText("Wildfires", { exact: true }).click();
  await expect(page.getByText("Northwest Territories Wildfires")).toBeHidden();
  await expect(page.getByText("M 7.1 - near Sendai, Japan")).toBeVisible();
});

test("opens a signal brief and exposes evidence, timeline, and Ask Earth", async ({
  page
}) => {
  await page.goto("/");
  await page.getByText("M 7.1 - near Sendai, Japan").click();

  await expect(page.getByTestId("event-detail")).toBeVisible();
  await expect(page.getByText("What happened?")).toBeVisible();
  await expect(page.getByText("37.1M")).toBeVisible();
  await expect(page.getByText("34", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "evidence" }).click();
  await expect(page.getByText("Evidence packet")).toBeVisible();
  await expect(page.getByText("Population proximity is not confirmed exposure.")).toHaveCount(0);

  await page.getByRole("button", { name: "timeline" }).click();
  await expect(page.getByText("Situation timeline")).toBeVisible();
  await expect(page.getByText("Weather context connected")).toBeVisible();

  const askInput = page.getByPlaceholder("Ask about this event…");
  await askInput.fill("What is known?");
  await askInput.press("Enter");
  await expect(page.getByText(/current packet shows one critical earthquake/)).toBeVisible();
});

test("keeps the mobile dashboard within the viewport", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("earth-map")).toBeVisible();
  const viewport = page.viewportSize();
  const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(viewport?.width ?? bodyWidth);

  const menu = page.getByRole("button", { name: "Open layer controls" });
  if (await menu.isVisible()) {
    await menu.click();
    await expect(page.getByText("Observation layers")).toBeVisible();
  }
});
