export type EventType =
  | "earthquake"
  | "wildfire"
  | "storm"
  | "flood"
  | "volcano"
  | "air_quality"
  | "climate";

export type RiskLevel = "low" | "moderate" | "high" | "critical";
export type EvidenceClass = "observed" | "computed" | "inferred" | "unknown";
export type Confidence = "low" | "medium" | "high";
export type SourceState = "live" | "cached" | "fallback" | "unavailable";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface EventSource {
  id: string;
  name: string;
  url: string;
  retrievedAt: string;
}

export interface EventSeverity {
  value: number;
  unit?: string;
  label: string;
}

export interface EarthEvent {
  id: string;
  type: EventType;
  title: string;
  location: string;
  coordinates: Coordinates;
  observedAt: string;
  updatedAt: string;
  status: "open" | "closed" | "unknown";
  severity?: EventSeverity;
  riskScore: number;
  riskLevel: RiskLevel;
  description?: string;
  source: EventSource;
  metadata: {
    depthKm?: number;
    tsunami?: boolean;
    category?: string;
    alertSeverity?: string;
    alertUrgency?: string;
    alertCertainty?: string;
  };
}

export interface SourceStatus {
  id: string;
  name: string;
  state: SourceState;
  eventCount: number;
  retrievedAt: string;
  note?: string;
}

export interface EarthStatus {
  totalActive: number;
  critical: number;
  high: number;
  trend: "stable" | "increasing" | "decreasing";
  byType: Record<EventType, number>;
}

export interface EventListResponse {
  events: EarthEvent[];
  status: EarthStatus;
  sources: SourceStatus[];
  generatedAt: string;
  degraded: boolean;
}

export interface EvidenceItem {
  id: string;
  classification: EvidenceClass;
  label: string;
  value: string;
  method?: string;
  sourceName?: string;
  sourceUrl?: string;
  confidence: Confidence;
  observedAt: string;
}

export interface WeatherContext {
  available: boolean;
  temperatureC?: number;
  apparentTemperatureC?: number;
  precipitationMm?: number;
  windSpeedKph?: number;
  windDirectionDegrees?: number;
  weatherCode?: number;
  observedAt?: string;
}

export interface AirQualityContext {
  available: boolean;
  usAqi?: number;
  pm25?: number;
  category?: string;
  observedAt?: string;
}

export interface PopulationContext {
  method: string;
  radiusKm: number;
  nearbyPlaces: Array<{
    name: string;
    country: string;
    distanceKm: number;
    population: number;
  }>;
  representedPopulation: number;
  label: string;
}

export interface InfrastructureContext {
  available: boolean;
  radiusKm: number;
  hospitalCount?: number;
  method: string;
}

export interface IntelligenceBrief {
  headline: string;
  whatHappened: string;
  whyItMatters: string;
  whatCouldHappenNext: string;
  limitations: string[];
  confidence: Confidence;
  generatedBy: "rules" | "workers-ai";
  generatedAt: string;
}

export interface TimelineEntry {
  id: string;
  at: string;
  title: string;
  description: string;
  classification: EvidenceClass;
}

export interface GraphNode {
  id: string;
  label: string;
  kind: "event" | "place" | "source" | "weather" | "infrastructure";
}

export interface GraphEdge {
  from: string;
  to: string;
  relationship: string;
  classification: EvidenceClass;
}

export interface EventDetailResponse {
  event: EarthEvent;
  weather: WeatherContext;
  airQuality: AirQualityContext;
  population: PopulationContext;
  infrastructure: InfrastructureContext;
  evidence: EvidenceItem[];
  brief: IntelligenceBrief;
  timeline: TimelineEntry[];
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}

export interface AskEarthRequest {
  question: string;
  eventId?: string;
  sessionId?: string;
}

export interface AskEarthResponse {
  answer: string;
  classification: EvidenceClass;
  confidence: Confidence;
  citations: Array<{
    label: string;
    url?: string;
  }>;
  sessionId: string;
  generatedBy: "rules" | "workers-ai";
  limitations: string[];
}
