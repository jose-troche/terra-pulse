import {
  sortByRiskAndTime,
  summarizeEarth,
  type EarthEvent,
  type EventListResponse,
  type EventType,
  type SourceState,
  type SourceStatus,
  type TimelineEntry
} from "@terra-pulse/earth-domain";
import { collectEonet } from "../collectors/eonet";
import { collectGdacsDroughts } from "../collectors/gdacs";
import { collectNws } from "../collectors/nws";
import { collectOpenMeteoAirQuality } from "../collectors/open-meteo-air";
import { collectUsgs } from "../collectors/usgs";
import { collectUsgsVolcanoes } from "../collectors/usgs-volcano";
import { fallbackEvents } from "./fallback";

interface SourceCollection {
  id: string;
  name: string;
  run: (env: Env) => Promise<{
    data: EarthEvent[];
    state: Exclude<SourceState, "fallback" | "unavailable">;
    retrievedAt: string;
  }>;
}

const collectors: SourceCollection[] = [
  {
    id: "usgs",
    name: "USGS Earthquake Hazards Program",
    run: collectUsgs
  },
  { id: "eonet", name: "NASA EONET", run: collectEonet },
  { id: "nws", name: "NOAA / National Weather Service", run: collectNws },
  {
    id: "usgs-volcano",
    name: "USGS Volcano Hazards Program",
    run: collectUsgsVolcanoes
  },
  {
    id: "open-meteo-air",
    name: "Open-Meteo / Copernicus CAMS Air Quality",
    run: collectOpenMeteoAirQuality
  },
  {
    id: "gdacs",
    name: "Global Disaster Alert and Coordination System (GDACS)",
    run: collectGdacsDroughts
  }
];

const eventTypeOrder: EventType[] = [
  "earthquake",
  "wildfire",
  "storm",
  "flood",
  "volcano",
  "air_quality",
  "climate"
];
const DEFAULT_TYPE_RESERVE = 8;

function logSourceFailure(id: string, error: unknown): void {
  console.warn(
    JSON.stringify({
      event: "source_collection_failed",
      source: id,
      message: error instanceof Error ? error.message : "Unknown error"
    })
  );
}

export async function collectEvents(env: Env): Promise<EventListResponse> {
  const results = await Promise.all(
    collectors.map(async (collector) => {
      try {
        const result = await collector.run(env);
        return {
          events: result.data,
          status: {
            id: collector.id,
            name: collector.name,
            state: result.state,
            eventCount: result.data.length,
            retrievedAt: result.retrievedAt
          } satisfies SourceStatus
        };
      } catch (error) {
        logSourceFailure(collector.id, error);
        return {
          events: [],
          status: {
            id: collector.id,
            name: collector.name,
            state: "unavailable",
            eventCount: 0,
            retrievedAt: new Date().toISOString(),
            note: "Source was unavailable during this refresh."
          } satisfies SourceStatus
        };
      }
    })
  );
  let events = sortByRiskAndTime(results.flatMap((result) => result.events));
  const sources: SourceStatus[] = results.map((result) => result.status);
  const degraded = sources.some((source) => source.state === "unavailable");
  if (events.length === 0) {
    events = fallbackEvents();
    sources.push({
      id: "fallback",
      name: "Terra Pulse demonstration data",
      state: "fallback",
      eventCount: events.length,
      retrievedAt: new Date().toISOString(),
      note: "Clearly labeled demonstration records are shown until live sources recover."
    });
  }
  return {
    events,
    status: summarizeEarth(events),
    sources,
    generatedAt: new Date().toISOString(),
    degraded
  };
}

export function filterEvents(
  response: EventListResponse,
  url: URL
): EventListResponse {
  const types = url.searchParams
    .get("types")
    ?.split(",")
    .filter(Boolean) as EventType[] | undefined;
  const search = url.searchParams.get("q")?.trim().toLowerCase();
  const minimumRisk = Number(url.searchParams.get("minRisk") ?? "0");
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("limit") ?? "120"))
  );
  const filtered = response.events.filter(
    (event) =>
      (!types || types.includes(event.type)) &&
      (!search ||
        event.title.toLowerCase().includes(search) ||
        event.location.toLowerCase().includes(search)) &&
      event.riskScore >= (Number.isFinite(minimumRisk) ? minimumRisk : 0)
  );
  const events =
    types || search || minimumRisk > 0
      ? filtered.slice(0, limit)
      : selectBalancedEvents(filtered, limit);
  return {
    ...response,
    events,
    status: summarizeEarth(events)
  };
}

export function selectBalancedEvents(
  events: EarthEvent[],
  limit: number
): EarthEvent[] {
  if (events.length <= limit) return events;
  const selected: EarthEvent[] = [];
  const selectedIds = new Set<string>();
  const perTypeReserve = Math.min(
    DEFAULT_TYPE_RESERVE,
    Math.max(1, Math.floor(limit / eventTypeOrder.length))
  );
  for (const type of eventTypeOrder) {
    const candidates = events
      .filter((event) => event.type === type)
      .slice(0, perTypeReserve);
    for (const event of candidates) {
      if (selected.length >= limit) break;
      selected.push(event);
      selectedIds.add(event.id);
    }
  }
  for (const event of events) {
    if (selected.length >= limit) break;
    if (selectedIds.has(event.id)) continue;
    selected.push(event);
    selectedIds.add(event.id);
  }
  return sortByRiskAndTime(selected);
}

export async function persistEvents(
  env: Env,
  events: EarthEvent[]
): Promise<void> {
  if (events.length === 0) return;
  const now = new Date().toISOString();
  try {
    const statements = events.slice(0, 150).map((event) =>
      env.DB.prepare(
        `INSERT INTO events (
          id, type, title, location, longitude, latitude, observed_at,
          updated_at, risk_score, risk_level, source_id, source_name,
          source_url, payload, first_seen_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          location = excluded.location,
          longitude = excluded.longitude,
          latitude = excluded.latitude,
          updated_at = excluded.updated_at,
          risk_score = excluded.risk_score,
          risk_level = excluded.risk_level,
          payload = excluded.payload,
          last_seen_at = excluded.last_seen_at`
      ).bind(
        event.id,
        event.type,
        event.title,
        event.location,
        event.coordinates.longitude,
        event.coordinates.latitude,
        event.observedAt,
        event.updatedAt,
        event.riskScore,
        event.riskLevel,
        event.source.id,
        event.source.name,
        event.source.url,
        JSON.stringify(event),
        now,
        now
      )
    );
    await env.DB.batch(statements);
    const historyStatements = events.slice(0, 150).map((event) =>
      env.DB.prepare(
        `INSERT INTO event_history (
          event_id, recorded_at, risk_score, risk_level, title
        )
        SELECT ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM event_history
          WHERE event_id = ? AND recorded_at = ?
        )`
      ).bind(
        event.id,
        event.updatedAt,
        event.riskScore,
        event.riskLevel,
        event.title,
        event.id,
        event.updatedAt
      )
    );
    await env.DB.batch(historyStatements);
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "event_persistence_failed",
        message: error instanceof Error ? error.message : "Unknown error"
      })
    );
  }
}

export async function loadHistory(
  env: Env,
  eventId: string
): Promise<TimelineEntry[]> {
  try {
    const rows = await env.DB.prepare(
      `SELECT recorded_at, risk_score, risk_level, title
       FROM event_history
       WHERE event_id = ?
       ORDER BY recorded_at DESC
       LIMIT 12`
    )
      .bind(eventId)
      .all<{
        recorded_at: string;
        risk_score: number;
        risk_level: string;
        title: string;
      }>();
    return rows.results.map((row, index) => ({
      id: `${eventId}:history:${index}`,
      at: row.recorded_at,
      title: `Priority recorded as ${row.risk_level}`,
      description: `${row.title} · score ${row.risk_score}/100`,
      classification: "computed"
    }));
  } catch {
    return [];
  }
}
