import type {
  AskEarthResponse,
  EarthEvent,
  EventDetailResponse,
  EventListResponse,
  EventType,
  RegionalRiskAnalysis
} from "@terra-pulse/earth-domain";
import { analyzeRegionalRisk } from "@terra-pulse/earth-domain";

export interface DeterministicAskResult {
  response: AskEarthResponse;
  regionalRisk?: RegionalRiskAnalysis;
}

function eventCitations(event: EarthEvent): AskEarthResponse["citations"] {
  return [{ label: event.source.name, url: event.source.url }];
}

const typeMatchers: Array<[EventType, RegExp]> = [
  ["earthquake", /\b(earthquake|earthquakes|quake|quakes|seismic)\b/],
  ["wildfire", /\b(wildfire|wildfires|fire|fires|smoke)\b/],
  ["storm", /\b(storm|storms|hurricane|hurricanes|typhoon|tornado)\b/],
  ["flood", /\b(flood|floods|flooding)\b/],
  ["volcano", /\b(volcano|volcanoes|volcanic|eruption)\b/],
  ["air_quality", /\b(air quality|pollution|particulate)\b/],
  ["climate", /\b(climate|heat|drought)\b/]
];

function requestedEventType(question: string): EventType | undefined {
  return typeMatchers.find(([, matcher]) => matcher.test(question))?.[0];
}

function asksForRegionalRisk(question: string): boolean {
  return (
    /\b(region|regions|area|areas|where|hotspot|hotspots|concentration|concentrations)\b/.test(
      question
    ) &&
    /\b(risk|risks|priority|priorities|elevated|higher|highest|active|activity)\b/.test(
      question
    )
  );
}

function uniqueCitations(
  events: EarthEvent[]
): AskEarthResponse["citations"] {
  return [
    ...new Map(
      events.map((event) => [
        event.source.url,
        { label: event.source.name, url: event.source.url }
      ])
    ).values()
  ];
}

function regionalRiskAnswer(
  analysis: RegionalRiskAnalysis,
  overview: EventListResponse,
  sessionId: string
): AskEarthResponse {
  if (analysis.regions.length === 0) {
    return {
      answer:
        "The current source packet does not contain enough matching geolocated events to compute regional monitoring priorities.",
      classification: "unknown",
      confidence: "low",
      citations: overview.sources.map((source) => ({ label: source.name })),
      sessionId,
      generatedBy: "rules",
      limitations: analysis.limitations
    };
  }
  const ranked = analysis.regions
    .slice(0, 3)
    .map(
      (region, index) =>
        `${index + 1}. ${region.label}: ${region.riskLevel} computed priority (${region.score}/100) from ${region.eventCount} active signal${region.eventCount === 1 ? "" : "s"}`
    )
    .join("; ");
  const relevantIds = new Set(
    analysis.regions.flatMap((region) =>
      region.examples.map((event) => event.id)
    )
  );
  return {
    answer: `Using deterministic ${analysis.clusterRadiusKm} km geographic clustering, the leading monitoring areas are ${ranked}. The scores combine source-derived event priority with local signal concentration; they are not forecasts.`,
    classification: "computed",
    confidence: overview.degraded ? "medium" : "high",
    citations: uniqueCitations(
      overview.events.filter((event) => relevantIds.has(event.id))
    ),
    sessionId,
    generatedBy: "rules",
    limitations: analysis.limitations
  };
}

export function deterministicAnswer(
  question: string,
  overview: EventListResponse,
  sessionId: string,
  detail?: EventDetailResponse
): DeterministicAskResult {
  const normalized = question.toLowerCase();
  if (detail) {
    const brief = detail.brief;
    if (/(what happened|known|observed|detect)/.test(normalized)) {
      return {
        response: {
          answer: brief.whatHappened,
          classification: "observed",
          confidence: brief.confidence,
          citations: eventCitations(detail.event),
          sessionId,
          generatedBy: "rules",
          limitations: brief.limitations
        }
      };
    }
    if (/(population|people|hospital|infrastructure|weather|air|wind)/.test(normalized)) {
      return {
        response: {
          answer: brief.whyItMatters,
          classification: "computed",
          confidence: "medium",
          citations: [
            ...eventCitations(detail.event),
            { label: "Open-Meteo", url: "https://open-meteo.com/" },
            { label: "OpenStreetMap", url: "https://www.openstreetmap.org/" }
          ],
          sessionId,
          generatedBy: "rules",
          limitations: brief.limitations
        }
      };
    }
    return {
      response: {
        answer: `${brief.whatCouldHappenNext} ${brief.limitations[0] ?? ""}`.trim(),
        classification: "inferred",
        confidence: brief.confidence,
        citations: eventCitations(detail.event),
        sessionId,
        generatedBy: "rules",
        limitations: brief.limitations
      }
    };
  }

  const requestedType = requestedEventType(normalized);
  if (asksForRegionalRisk(normalized)) {
    const regionalRisk = analyzeRegionalRisk(overview.events, {
      ...(requestedType ? { eventType: requestedType } : {}),
      generatedAt: overview.generatedAt
    });
    return {
      response: regionalRiskAnswer(regionalRisk, overview, sessionId),
      regionalRisk
    };
  }
  const relevant = overview.events
    .filter((event) => !requestedType || event.type === requestedType)
    .slice(0, 5);
  if (relevant.length === 0) {
    return {
      response: {
        answer:
          "The current source packet does not contain a matching event. This does not prove that no such condition exists; source coverage and latency vary.",
        classification: "unknown",
        confidence: "low",
        citations: overview.sources.map((source) => ({ label: source.name })),
        sessionId,
        generatedBy: "rules",
        limitations: ["The answer is limited to the currently retrieved public source packet."]
      }
    };
  }
  const summary = relevant
    .map(
      (event) =>
        `${event.title} (${event.riskLevel} monitoring priority, ${event.location})`
    )
    .join("; ");
  return {
    response: {
      answer: `The highest-priority matching signals in the current packet are: ${summary}. Select an event for evidence, weather, population context, and an evolving timeline.`,
      classification: "observed",
      confidence: overview.degraded ? "medium" : "high",
      citations: relevant.flatMap(eventCitations),
      sessionId,
      generatedBy: "rules",
      limitations: [
        "This is a snapshot of connected sources, not a complete census of all hazards."
      ]
    }
  };
}
