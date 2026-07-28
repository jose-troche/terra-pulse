import type { EarthEvent, EventType, RiskLevel } from "./types";

const typeBaselines: Record<EventType, number> = {
  earthquake: 10,
  wildfire: 56,
  storm: 52,
  flood: 58,
  volcano: 64,
  air_quality: 42,
  climate: 35
};

export function riskLevelFor(score: number): RiskLevel {
  if (score >= 82) return "critical";
  if (score >= 62) return "high";
  if (score >= 36) return "moderate";
  return "low";
}

export function earthquakeRiskScore(
  magnitude: number,
  depthKm: number | undefined,
  tsunami: boolean
): number {
  const depthAdjustment = depthKm === undefined
    ? 0
    : depthKm <= 25
      ? 10
      : depthKm <= 70
        ? 5
        : -4;
  return Math.round(
    Math.max(5, Math.min(100, magnitude * 11 + depthAdjustment + (tsunami ? 14 : 0)))
  );
}

export function categoricalRiskScore(
  type: Exclude<EventType, "earthquake">,
  severity?: string
): number {
  const normalized = severity?.toLowerCase() ?? "";
  const severityAdjustment =
    normalized.includes("extreme") || normalized.includes("severe")
      ? 22
      : normalized.includes("moderate")
        ? 10
        : 0;
  return Math.min(100, typeBaselines[type] + severityAdjustment);
}

export function sortByRiskAndTime(events: EarthEvent[]): EarthEvent[] {
  return [...events].sort(
    (a, b) =>
      b.riskScore - a.riskScore ||
      Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  );
}
