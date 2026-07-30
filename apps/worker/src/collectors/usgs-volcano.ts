import {
  riskLevelFor,
  validCoordinates,
  type EarthEvent
} from "@terra-pulse/earth-domain";
import { fetchSourceJson, type CollectedPayload } from "./shared";

const ELEVATED_VOLCANOES_URL =
  "https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes";
const VOLCANO_API_ROOT =
  "https://volcanoes.usgs.gov/hans-public/api/volcano/getVolcano";

interface UsgsVolcanoAlert {
  volcano_name?: unknown;
  vnum?: unknown;
  obs_fullname?: unknown;
  notice_identifier?: unknown;
  sent_utc?: unknown;
  sent_unixtime?: unknown;
  color_code?: unknown;
  alert_level?: unknown;
  notice_url?: unknown;
}

interface UsgsVolcanoProfile {
  volcano_name?: unknown;
  vnum?: unknown;
  region?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  elevation_meters?: unknown;
  volcano_url?: unknown;
  hans_url?: unknown;
}

function volcanoRiskScore(colorCode: string, alertLevel: string): number {
  const value = `${colorCode} ${alertLevel}`.toLowerCase();
  if (value.includes("red") || value.includes("warning")) return 92;
  if (value.includes("orange") || value.includes("watch")) return 78;
  if (value.includes("yellow") || value.includes("advisory")) return 64;
  return 52;
}

function alertTime(alert: UsgsVolcanoAlert, retrievedAt: string): string {
  if (typeof alert.sent_unixtime === "number") {
    return new Date(alert.sent_unixtime * 1000).toISOString();
  }
  if (typeof alert.sent_utc === "string") {
    const parsed = Date.parse(`${alert.sent_utc.replace(" ", "T")}Z`);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return retrievedAt;
}

export function normalizeUsgsVolcanoes(
  alerts: UsgsVolcanoAlert[],
  profiles: UsgsVolcanoProfile[],
  retrievedAt: string
): EarthEvent[] {
  const profilesByVnum = new Map(
    profiles
      .filter((profile) => typeof profile.vnum === "string")
      .map((profile) => [profile.vnum as string, profile])
  );
  const events: EarthEvent[] = [];
  for (const alert of alerts) {
    if (typeof alert.vnum !== "string") continue;
    const profile = profilesByVnum.get(alert.vnum);
    if (
      !profile ||
      typeof profile.latitude !== "number" ||
      typeof profile.longitude !== "number"
    ) {
      continue;
    }
    const coordinates = {
      latitude: profile.latitude,
      longitude: profile.longitude
    };
    if (!validCoordinates(coordinates)) continue;
    const name =
      typeof alert.volcano_name === "string"
        ? alert.volcano_name
        : typeof profile.volcano_name === "string"
          ? profile.volcano_name
          : `Volcano ${alert.vnum}`;
    const colorCode =
      typeof alert.color_code === "string" ? alert.color_code : "Unassigned";
    const alertLevel =
      typeof alert.alert_level === "string" ? alert.alert_level : "Unassigned";
    const observedAt = alertTime(alert, retrievedAt);
    const riskScore = volcanoRiskScore(colorCode, alertLevel);
    const observatory =
      typeof alert.obs_fullname === "string"
        ? alert.obs_fullname
        : "USGS Volcano Hazards Program";
    const region =
      typeof profile.region === "string" ? profile.region : "United States";
    events.push({
      id: `usgs-volcano:${alert.vnum}`,
      type: "volcano",
      title: `${name} · ${colorCode} / ${alertLevel}`,
      location: region,
      coordinates,
      observedAt,
      updatedAt: observedAt,
      status: "open",
      severity: {
        value: riskScore,
        unit: "priority",
        label: `${colorCode} aviation color · ${alertLevel} alert`
      },
      riskScore,
      riskLevel: riskLevelFor(riskScore),
      description: `${observatory} lists ${name} at ${colorCode} aviation color and ${alertLevel} volcano alert level.`,
      source: {
        id: "usgs-volcano",
        name: "USGS Volcano Hazards Program",
        url:
          typeof alert.notice_url === "string"
            ? alert.notice_url
            : typeof profile.hans_url === "string"
              ? profile.hans_url
              : ELEVATED_VOLCANOES_URL,
        retrievedAt
      },
      metadata: {
        category: "Elevated volcano alert"
      }
    });
  }
  return events;
}

export async function collectUsgsVolcanoes(
  env: Env
): Promise<CollectedPayload<EarthEvent[]>> {
  const alertsResponse = await fetchSourceJson<UsgsVolcanoAlert[]>(
    env,
    ELEVATED_VOLCANOES_URL,
    {
      cacheKey: "source:usgs-volcano:elevated:v1",
      ttlSeconds: 900
    }
  );
  const alerts = Array.isArray(alertsResponse.data)
    ? alertsResponse.data.slice(0, 20)
    : [];
  const vnums = [
    ...new Set(
      alerts
        .map((alert) => alert.vnum)
        .filter((value): value is string => typeof value === "string")
    )
  ];
  const profileResults = await Promise.allSettled(
    vnums.map(async (vnum) => {
      const response = await fetchSourceJson<UsgsVolcanoProfile>(
        env,
        `${VOLCANO_API_ROOT}/${encodeURIComponent(vnum)}`,
        {
          cacheKey: `source:usgs-volcano:profile:${vnum}:v1`,
          ttlSeconds: 86_400
        }
      );
      return response.data;
    })
  );
  const profiles = profileResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  );
  return {
    ...alertsResponse,
    data: normalizeUsgsVolcanoes(
      alerts,
      profiles,
      alertsResponse.retrievedAt
    )
  };
}
