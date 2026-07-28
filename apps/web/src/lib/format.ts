import type { EventType } from "@terra-pulse/earth-domain";

export const eventLabels: Record<EventType, string> = {
  earthquake: "Earthquakes",
  wildfire: "Wildfires",
  storm: "Storm systems",
  flood: "Flood risks",
  volcano: "Volcanoes",
  air_quality: "Air quality",
  climate: "Climate anomalies"
};

export const eventColors: Record<EventType, string> = {
  earthquake: "#f3b75f",
  wildfire: "#ff714b",
  storm: "#6da9ff",
  flood: "#44c7d8",
  volcano: "#f25273",
  air_quality: "#b68cff",
  climate: "#77dfb5"
};

export function relativeTime(value: string): string {
  const seconds = Math.round((Date.now() - Date.parse(value)) / 1000);
  if (!Number.isFinite(seconds)) return "time unknown";
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(-seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(-hours, "hour");
  return formatter.format(-Math.round(hours / 24), "day");
}

export function formatPopulation(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return value.toLocaleString("en-US");
}

export function compactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function compassDirection(degrees: number | undefined): string {
  if (degrees === undefined) return "";
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(degrees / 45) % 8] ?? "";
}
