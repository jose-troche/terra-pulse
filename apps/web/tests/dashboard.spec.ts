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
  degraded: false,
  viewerLocation: {
    coordinates: { latitude: 37.7749, longitude: -122.4194 },
    source: "cloudflare",
    precision: "approximate",
    city: "San Francisco",
    region: "California",
    country: "US"
  }
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
      const payload = request.postDataJSON() as { question?: string };
      const isRegionalWildfireQuestion = payload.question
        ?.toLowerCase()
        .includes("elevated wildfire risk");
      await route.fulfill({
        json: {
          answer: isRegionalWildfireQuestion
            ? "Using deterministic 350 km geographic clustering, Northwest Territories, Canada is the leading computed monitoring area with 1 active signal. This is not a forecast."
            : "The current packet shows one critical earthquake and two high-priority weather or fire signals.",
          classification: isRegionalWildfireQuestion
            ? "computed"
            : "observed",
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

test("publishes the Terra Pulse favicon and install icons", async ({
  page
}) => {
  await page.goto("/");

  await expect(
    page.locator('link[rel="icon"][href="/favicon.svg"]')
  ).toHaveAttribute("sizes", "any");
  await expect(
    page.locator('link[rel="apple-touch-icon"]')
  ).toHaveAttribute("href", "/apple-touch-icon.png");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/site.webmanifest"
  );

  const [svg, ico, appleTouch, manifest] = await Promise.all([
    page.request.get("/favicon.svg"),
    page.request.get("/favicon.ico"),
    page.request.get("/apple-touch-icon.png"),
    page.request.get("/site.webmanifest")
  ]);
  expect(svg.ok()).toBe(true);
  expect(ico.ok()).toBe(true);
  expect(appleTouch.ok()).toBe(true);
  expect(manifest.ok()).toBe(true);
  expect(await svg.text()).toContain('viewBox="0 0 64 64"');
  expect((await ico.body()).byteLength).toBeGreaterThan(500);
  expect((await appleTouch.body()).byteLength).toBeGreaterThan(1_000);
  await expect(manifest.json()).resolves.toMatchObject({
    short_name: "TerraPulse",
    icons: [
      { src: "/icon-192.png", sizes: "192x192" },
      { src: "/icon-512.png", sizes: "512x512" }
    ]
  });
});

async function openDashboard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start exploring" }).click();
}

async function smallestVisibleFontSize(
  page: Page,
  rootSelector = "body"
): Promise<number> {
  return page.locator(rootSelector).evaluate((root) => {
    let smallest = Number.POSITIVE_INFINITY;
    for (const element of root.querySelectorAll("*")) {
      const style = window.getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      const text = element.textContent?.trim();
      if (
        !text ||
        style.display === "none" ||
        style.visibility === "hidden" ||
        bounds.width <= 0 ||
        bounds.height <= 0
      ) {
        continue;
      }
      smallest = Math.min(smallest, Number.parseFloat(style.fontSize));
    }
    return smallest;
  });
}

test("orients first-time users and explains the header actions", async ({ page }) => {
  await page.goto("/");

  const guide = page.getByRole("dialog", {
    name: "Read the planet in three moves"
  });
  await expect(guide).toBeVisible();
  await expect(guide.getByText("Choose observation layers")).toBeVisible();
  await expect(guide.getByText("Select a map signal or feed card")).toBeVisible();
  await page.getByRole("button", { name: "Start exploring" }).click();

  const notifications = page.getByRole("button", {
    name: "View priority alert summary"
  });
  await expect(notifications).toHaveAttribute(
    "title",
    "View priority alert summary"
  );
  await notifications.click();
  await expect(page.getByText("Signals needing attention")).toBeVisible();
  await expect(page.getByText("Terra Pulse does not send browser push notifications.")).toBeVisible();
  await page
    .getByRole("button", { name: "Close priority alert summary" })
    .last()
    .click();

  const help = page.getByRole("button", { name: "How to use Terra Pulse" });
  await expect(help).toHaveAttribute("title", "How to use Terra Pulse");
  await help.click();
  await expect(guide).toBeVisible();
});

test("renders the live Earth dashboard and filters layers", async ({ page }) => {
  await openDashboard(page);

  await expect(
    page.getByRole("heading", { name: /What is happening/ })
  ).toBeVisible();
  await expect(page.locator(".map-signal-count")).toContainText(
    "3 signals plotted",
    { timeout: 15_000 }
  );
  await expect(page.locator(".map-shell")).toHaveAttribute(
    "data-starting-view",
    "viewer"
  );
  await expect(page.locator(".map-shell")).toHaveAttribute(
    "data-event-icons",
    "ready",
    { timeout: 15_000 }
  );
  await expect(page.locator(".map-shell")).toHaveAttribute(
    "data-severity-dots",
    "ready",
    { timeout: 15_000 }
  );
  await expect(page.locator(".map-shell")).toHaveAttribute(
    "data-basemap-language",
    "en"
  );
  await expect(page.locator(".map-shell")).toHaveAttribute(
    "data-basemap-palette",
    "standard"
  );
  await expect(page.locator(".map-coordinate-label")).toContainText(
    "STARTING NEAR San Francisco, California · APPROXIMATE"
  );
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

test("filters the map and feed from the critical and high totals", async ({
  page
}) => {
  await openDashboard(page);
  const menu = page.getByRole("button", { name: "Open layer controls" });
  if (await menu.isVisible()) await menu.click();

  await page.getByRole("button", { name: "Show critical events" }).click();
  await expect(page.getByRole("heading", { name: "Critical signals" })).toBeVisible();
  await expect(page.locator(".event-card")).toHaveCount(1);
  await expect(page.getByText("M 7.1 - near Sendai, Japan")).toBeVisible();
  await expect(page.getByText("Northwest Territories Wildfires")).toBeHidden();
  await expect(page.locator(".map-signal-count")).toContainText(
    "1 signal plotted",
    { timeout: 15_000 }
  );
  await expect(page.locator(".map-shell")).toHaveAttribute(
    "data-camera-focus",
    "critical:1"
  );

  await page.getByRole("button", { name: "Clear filter" }).click();
  await expect(page.locator(".event-card")).toHaveCount(3);
  await expect(page.locator(".map-signal-count")).toContainText(
    "3 signals plotted",
    { timeout: 15_000 }
  );

  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("button", { name: "Show high priority events" })
    .click();
  await expect(page.getByRole("heading", { name: "High signals" })).toBeVisible();
  await expect(page.locator(".event-card")).toHaveCount(2);
  await expect(page.getByText("M 7.1 - near Sendai, Japan")).toBeHidden();
  await expect(page.locator(".map-signal-count")).toContainText(
    "2 signals plotted",
    { timeout: 15_000 }
  );
  await expect(page.locator(".map-shell")).toHaveAttribute(
    "data-camera-focus",
    "high:2"
  );
});

test("opens a signal brief and exposes evidence, timeline, and Ask Earth", async ({
  page
}) => {
  await openDashboard(page);
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
  await expect(
    page.getByRole("button", { name: "Ask another question" })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close Ask Earth response" })
    .click();
  await expect(
    page.getByText(/current packet shows one critical earthquake/)
  ).toBeHidden();
  await expect(askInput).toBeFocused();
  await expect(askInput).toHaveValue("");

  await askInput.fill("What changed?");
  await askInput.press("Enter");
  await expect(page.getByText(/current packet shows one critical earthquake/)).toBeVisible();
});

test("returns from an Ask Earth answer to the example questions", async ({
  page
}) => {
  await openDashboard(page);
  const menu = page.getByRole("button", { name: "Open layer controls" });
  if (await menu.isVisible()) await menu.click();

  await page
    .getByRole("button", { name: "What is happening around the world today?" })
    .click();
  await expect(
    page.getByText(/current packet shows one critical earthquake/)
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to example questions" })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Which areas show elevated wildfire risk?"
    })
  ).toBeVisible();
});

test("uses computed clustering for regional wildfire risk", async ({ page }) => {
  await openDashboard(page);
  const menu = page.getByRole("button", { name: "Open layer controls" });
  if (await menu.isVisible()) await menu.click();

  await page
    .getByRole("button", {
      name: "Which areas show elevated wildfire risk?"
    })
    .click();
  await expect(page.getByText(/deterministic 350 km geographic clustering/)).toBeVisible();
  await expect(page.getByText(/not a forecast/)).toBeVisible();
});

test("keeps dashboard intelligence and reports legible", async ({ page }) => {
  test.setTimeout(60_000);
  await openDashboard(page);
  await expect(page.locator(".map-signal-count")).toContainText(
    "3 signals plotted",
    { timeout: 15_000 }
  );
  expect(await smallestVisibleFontSize(page)).toBeGreaterThanOrEqual(10);

  const menu = page.getByRole("button", { name: "Open layer controls" });
  if (await menu.isVisible()) await menu.click();
  const regionalQuestion = page.getByRole("button", {
    name: "Which areas show elevated wildfire risk?"
  });
  await expect(regionalQuestion).toHaveCSS("font-size", "12px");
  await regionalQuestion.click();
  await expect(page.locator(".ask-answer p")).toHaveCSS("font-size", "13px");
  if (await menu.isVisible()) await menu.click();

  await page.locator(".event-card").first().click();
  await expect(page.getByTestId("event-detail")).toBeVisible();
  await expect(page.locator(".brief-section > p").first()).toHaveCSS(
    "font-size",
    "13px"
  );
  expect(
    await smallestVisibleFontSize(page, "[data-testid='event-detail']")
  ).toBeGreaterThanOrEqual(10);

  await page.getByRole("button", { name: "connections" }).click();
  await expect(page.locator(".knowledge-graph text").first()).toHaveCSS(
    "font-size",
    "10px"
  );
});

test("keeps the mobile dashboard within the viewport", async ({ page }) => {
  await openDashboard(page);
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

test("renders the event relationship graph in the mobile page flow", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "This regression covers the phone layout."
  );

  await openDashboard(page);
  await page.locator(".event-card").first().click();
  await expect(page.getByTestId("event-detail")).toBeVisible();
  await page.getByRole("button", { name: "connections" }).click();

  const graph = page.locator(".knowledge-graph");
  await graph.scrollIntoViewIfNeeded();
  await expect(graph).toBeInViewport();
  await expect(graph.locator(".graph-node")).toHaveCount(3);
  await expect(graph.locator(".graph-edge")).toHaveCount(2);
  await expect(graph.locator("svg")).toBeVisible();
  await expect(page.locator(".detail-scroll")).toHaveCSS(
    "overflow-y",
    "visible"
  );

  const viewportWidth = page.viewportSize()?.width ?? 0;
  const bounds = await graph.boundingBox();
  expect(bounds?.width ?? 0).toBeGreaterThan(250);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
    viewportWidth
  );
});
