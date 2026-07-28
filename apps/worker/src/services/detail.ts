import {
  buildDeterministicBrief,
  buildEvidence,
  buildGraph,
  buildTimeline,
  nearbyPopulation,
  type EventDetailResponse
} from "@terra-pulse/earth-domain";
import { contextForEvent } from "./context";
import { collectEvents, loadHistory } from "./events";

export async function eventDetail(
  env: Env,
  eventId: string
): Promise<EventDetailResponse | undefined> {
  const response = await collectEvents(env);
  const event = response.events.find((candidate) => candidate.id === eventId);
  if (!event) return undefined;
  const [{ weather, airQuality, infrastructure }, history] = await Promise.all([
    contextForEvent(env, event),
    loadHistory(env, event.id)
  ]);
  const population = nearbyPopulation(event);
  return {
    event,
    weather,
    airQuality,
    population,
    infrastructure,
    evidence: buildEvidence(
      event,
      weather,
      airQuality,
      population,
      infrastructure
    ),
    brief: buildDeterministicBrief(
      event,
      weather,
      population,
      infrastructure
    ),
    timeline: buildTimeline(event, weather, infrastructure, history),
    graph: buildGraph(event, weather, population, infrastructure)
  };
}
