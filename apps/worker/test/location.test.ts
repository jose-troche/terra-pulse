import { describe, expect, it } from "vitest";
import { viewerLocationFromCf } from "../src/services/location";

describe("viewer location", () => {
  it("normalizes coarse Cloudflare request geography", () => {
    expect(
      viewerLocationFromCf({
        latitude: "37.7749",
        longitude: "-122.4194",
        city: " San Francisco ",
        region: "California",
        country: "US"
      })
    ).toEqual({
      coordinates: { latitude: 37.7749, longitude: -122.4194 },
      source: "cloudflare",
      precision: "approximate",
      city: "San Francisco",
      region: "California",
      country: "US"
    });
  });

  it("rejects missing or invalid coordinates", () => {
    expect(viewerLocationFromCf(undefined)).toBeUndefined();
    expect(
      viewerLocationFromCf({ latitude: "", longitude: "-122" })
    ).toBeUndefined();
    expect(
      viewerLocationFromCf({ latitude: "95", longitude: "-122" })
    ).toBeUndefined();
    expect(
      viewerLocationFromCf({ latitude: "north", longitude: "west" })
    ).toBeUndefined();
  });
});
