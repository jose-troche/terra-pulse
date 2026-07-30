import type { SourceState } from "@terra-pulse/earth-domain";

const MAX_SOURCE_BYTES = 5_000_000;

export interface CollectedPayload<T> {
  data: T;
  state: Exclude<SourceState, "fallback" | "unavailable">;
  retrievedAt: string;
}

interface FetchJsonOptions {
  cacheKey: string;
  ttlSeconds: number;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export async function fetchSourceJson<T>(
  env: Env,
  url: string,
  options: FetchJsonOptions
): Promise<CollectedPayload<T>> {
  const cached = await env.EARTH_CACHE.get(options.cacheKey, "json");
  if (cached !== null) {
    return {
      data: cached as T,
      state: "cached",
      retrievedAt: new Date().toISOString()
    };
  }

  const controller = new AbortController();
  const timeoutMs = Math.min(
    15_000,
    Math.max(1_000, options.timeoutMs ?? 8_000)
  );
  const timeout = setTimeout(
    () => controller.abort("Source request timed out"),
    timeoutMs
  );
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/geo+json, application/json",
        "user-agent": "TerraPulse/0.1 (public Earth intelligence dashboard)",
        ...options.headers
      }
    });
    if (!response.ok) {
      throw new Error(`Source returned ${response.status}`);
    }
    const length = Number(response.headers.get("content-length") ?? "0");
    if (length > MAX_SOURCE_BYTES) {
      throw new Error("Source payload exceeds the configured safety limit");
    }
    const data = (await response.json()) as T;
    await env.EARTH_CACHE.put(options.cacheKey, JSON.stringify(data), {
      expirationTtl: options.ttlSeconds
    });
    return {
      data,
      state: "live",
      retrievedAt: new Date().toISOString()
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function firstCoordinate(value: unknown): [number, number] | undefined {
  if (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    return [value[0], value[1]];
  }
  if (Array.isArray(value)) {
    for (const candidate of value) {
      const coordinate = firstCoordinate(candidate);
      if (coordinate) return coordinate;
    }
  }
  return undefined;
}
