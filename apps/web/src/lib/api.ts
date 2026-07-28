import type {
  AskEarthRequest,
  AskEarthResponse,
  EventDetailResponse,
  EventListResponse
} from "@terra-pulse/earth-domain";

interface ApiError {
  error?: string;
  code?: string;
}

async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with ${response.status}`);
  }
  return payload;
}

export function getEvents(signal?: AbortSignal): Promise<EventListResponse> {
  return requestJson<EventListResponse>("/api/events", { signal });
}

export function getEventDetail(
  eventId: string,
  signal?: AbortSignal
): Promise<EventDetailResponse> {
  return requestJson<EventDetailResponse>(
    `/api/events/${encodeURIComponent(eventId)}`,
    { signal }
  );
}

export function askEarth(
  payload: AskEarthRequest,
  signal?: AbortSignal
): Promise<AskEarthResponse> {
  return requestJson<AskEarthResponse>("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal
  });
}
