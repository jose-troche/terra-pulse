import type {
  AskEarthResponse,
  EarthEvent,
  EventDetailResponse,
  EventListResponse
} from "@terra-pulse/earth-domain";

function eventCitations(event: EarthEvent): AskEarthResponse["citations"] {
  return [{ label: event.source.name, url: event.source.url }];
}

export function deterministicAnswer(
  question: string,
  overview: EventListResponse,
  sessionId: string,
  detail?: EventDetailResponse
): AskEarthResponse {
  const normalized = question.toLowerCase();
  if (detail) {
    const brief = detail.brief;
    if (/(what happened|known|observed|detect)/.test(normalized)) {
      return {
        answer: brief.whatHappened,
        classification: "observed",
        confidence: brief.confidence,
        citations: eventCitations(detail.event),
        sessionId,
        generatedBy: "rules",
        limitations: brief.limitations
      };
    }
    if (/(population|people|hospital|infrastructure|weather|air|wind)/.test(normalized)) {
      return {
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
      };
    }
    return {
      answer: `${brief.whatCouldHappenNext} ${brief.limitations[0] ?? ""}`.trim(),
      classification: "inferred",
      confidence: brief.confidence,
      citations: eventCitations(detail.event),
      sessionId,
      generatedBy: "rules",
      limitations: brief.limitations
    };
  }

  const types: Array<EarthEvent["type"]> = [
    "earthquake",
    "wildfire",
    "storm",
    "flood",
    "volcano",
    "air_quality",
    "climate"
  ];
  const requestedType = types.find((type) =>
    normalized.includes(type.replace("_", " "))
  );
  const relevant = overview.events
    .filter((event) => !requestedType || event.type === requestedType)
    .slice(0, 5);
  if (relevant.length === 0) {
    return {
      answer:
        "The current source packet does not contain a matching event. This does not prove that no such condition exists; source coverage and latency vary.",
      classification: "unknown",
      confidence: "low",
      citations: overview.sources.map((source) => ({ label: source.name })),
      sessionId,
      generatedBy: "rules",
      limitations: ["The answer is limited to the currently retrieved public source packet."]
    };
  }
  const summary = relevant
    .map(
      (event) =>
        `${event.title} (${event.riskLevel} monitoring priority, ${event.location})`
    )
    .join("; ");
  return {
    answer: `The highest-priority matching signals in the current packet are: ${summary}. Select an event for evidence, weather, population context, and an evolving timeline.`,
    classification: "observed",
    confidence: overview.degraded ? "medium" : "high",
    citations: relevant.flatMap(eventCitations),
    sessionId,
    generatedBy: "rules",
    limitations: [
      "This is a snapshot of connected sources, not a complete census of all hazards."
    ]
  };
}
