import { haversineKm, validCoordinates } from "./geo";
import { riskLevelFor } from "./risk";
import type {
  Coordinates,
  EarthEvent,
  EventType,
  RegionalRiskAnalysis,
  RegionalRiskRegion
} from "./types";

const DEFAULT_CLUSTER_RADIUS_KM = 350;
const MAX_REGIONS = 5;

interface WorkingCluster {
  events: EarthEvent[];
  center: Coordinates;
}

export interface RegionalRiskOptions {
  eventType?: EventType;
  clusterRadiusKm?: number;
  generatedAt?: string;
  maxRegions?: number;
}

function byPriority(left: EarthEvent, right: EarthEvent): number {
  return (
    right.riskScore - left.riskScore ||
    Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function regionToken(location: string): string {
  const parts = location
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) ?? location.trim();
}

function clusterLabel(events: EarthEvent[]): string {
  if (events.length === 1) return events[0]!.location;
  const counts = new Map<string, number>();
  for (const event of events) {
    const token = regionToken(event.location);
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort(
    ([leftLabel, leftCount], [rightLabel, rightCount]) =>
      rightCount - leftCount || leftLabel.localeCompare(rightLabel)
  );
  const leading = ranked
    .slice(0, 2)
    .map(([label]) => label);
  return `${leading.join("–")} area`;
}

function clusterScore(events: EarthEvent[]): {
  mean: number;
  max: number;
  score: number;
} {
  const scores = events.map((event) => event.riskScore);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const max = Math.max(...scores);
  const concentrationBonus = Math.min(
    24,
    Math.round(Math.log2(events.length) * 6)
  );
  return {
    mean: Math.round(mean),
    max,
    score: Math.min(100, Math.round(mean + concentrationBonus))
  };
}

function addToCluster(cluster: WorkingCluster, event: EarthEvent): void {
  const count = cluster.events.length;
  cluster.center = {
    latitude:
      (cluster.center.latitude * count + event.coordinates.latitude) /
      (count + 1),
    longitude:
      (cluster.center.longitude * count + event.coordinates.longitude) /
      (count + 1)
  };
  cluster.events.push(event);
}

function toRegion(cluster: WorkingCluster, index: number): RegionalRiskRegion {
  const events = [...cluster.events].sort(byPriority);
  const scores = clusterScore(events);
  return {
    id: `region-${index + 1}`,
    label: clusterLabel(events),
    center: {
      latitude: Number(cluster.center.latitude.toFixed(4)),
      longitude: Number(cluster.center.longitude.toFixed(4))
    },
    eventCount: events.length,
    score: scores.score,
    riskLevel: riskLevelFor(scores.score),
    meanEventRiskScore: scores.mean,
    maxEventRiskScore: scores.max,
    latestUpdatedAt: events
      .map((event) => event.updatedAt)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0]!,
    examples: events.slice(0, 3).map((event) => ({
      id: event.id,
      title: event.title,
      location: event.location,
      type: event.type,
      riskScore: event.riskScore
    }))
  };
}

function localAnchor(region: RegionalRiskRegion): string {
  const location = region.examples[0]?.location ?? "";
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const withoutRegion = parts.length > 1 ? parts.slice(0, -1) : parts;
  return withoutRegion.slice(0, 2).join(", ");
}

function disambiguateLabels(
  regions: RegionalRiskRegion[]
): RegionalRiskRegion[] {
  const counts = new Map<string, number>();
  for (const region of regions) {
    counts.set(region.label, (counts.get(region.label) ?? 0) + 1);
  }
  return regions.map((region) => {
    if ((counts.get(region.label) ?? 0) < 2) return region;
    const base = region.label.replace(/ area$/, "");
    const anchor = localAnchor(region);
    return {
      ...region,
      label: anchor ? `${base} near ${anchor}` : region.label
    };
  });
}

export function analyzeRegionalRisk(
  events: EarthEvent[],
  options: RegionalRiskOptions = {}
): RegionalRiskAnalysis {
  const clusterRadiusKm =
    options.clusterRadiusKm ?? DEFAULT_CLUSTER_RADIUS_KM;
  const candidates = events
    .filter(
      (event) =>
        validCoordinates(event.coordinates) &&
        (!options.eventType || event.type === options.eventType)
    )
    .sort(byPriority);
  const clusters: WorkingCluster[] = [];

  for (const event of candidates) {
    const nearby = clusters
      .map((cluster, index) => ({
        cluster,
        index,
        distance: haversineKm(cluster.center, event.coordinates)
      }))
      .filter(({ distance }) => distance <= clusterRadiusKm)
      .sort(
        (left, right) =>
          left.distance - right.distance || left.index - right.index
      )[0];
    if (nearby) addToCluster(nearby.cluster, event);
    else {
      clusters.push({
        events: [event],
        center: { ...event.coordinates }
      });
    }
  }

  const regions = disambiguateLabels(
    clusters
    .map(toRegion)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.eventCount - left.eventCount ||
        right.maxEventRiskScore - left.maxEventRiskScore ||
        left.label.localeCompare(right.label)
    )
    .slice(0, options.maxRegions ?? MAX_REGIONS)
  ).map((region, index) => ({ ...region, id: `region-${index + 1}` }));

  return {
    ...(options.eventType ? { requestedType: options.eventType } : {}),
    method:
      "Active source records are grouped into deterministic geographic clusters; each cluster combines the mean source-derived event score with a capped concentration bonus.",
    clusterRadiusKm,
    analyzedEventCount: candidates.length,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    regions,
    limitations: [
      "This is a computed monitoring priority from connected active-event sources, not a hazard probability or forecast.",
      "Source coverage, reporting thresholds, and update timing vary by location.",
      `The ${clusterRadiusKm} km cluster radius and concentration adjustment are transparent approximations.`
    ]
  };
}
