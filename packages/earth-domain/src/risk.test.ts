import { describe, expect, it } from "vitest";
import {
  earthquakeRiskScore,
  haversineKm,
  riskLevelFor,
  validCoordinates
} from "./index";

describe("Earth domain rules", () => {
  it("raises monitoring priority for shallow tsunami-flagged earthquakes", () => {
    const routine = earthquakeRiskScore(6.2, 100, false);
    const shallowTsunami = earthquakeRiskScore(6.2, 15, true);
    expect(shallowTsunami).toBeGreaterThan(routine);
    expect(riskLevelFor(shallowTsunami)).toBe("critical");
  });

  it("calculates geographic proximity in kilometers", () => {
    const distance = haversineKm(
      { latitude: 40.7128, longitude: -74.006 },
      { latitude: 51.5072, longitude: -0.1276 }
    );
    expect(distance).toBeGreaterThan(5500);
    expect(distance).toBeLessThan(5700);
  });

  it("rejects malformed map coordinates", () => {
    expect(validCoordinates({ latitude: 91, longitude: 0 })).toBe(false);
    expect(validCoordinates({ latitude: 45, longitude: -122 })).toBe(true);
  });
});
