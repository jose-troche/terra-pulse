import {
  validCoordinates,
  type ViewerLocation
} from "@terra-pulse/earth-domain";

interface GeographicRequestMetadata {
  latitude?: unknown;
  longitude?: unknown;
  city?: unknown;
  region?: unknown;
  country?: unknown;
}

function optionalLabel(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 80)
    : undefined;
}

export function viewerLocationFromCf(
  cf: Request["cf"] | GeographicRequestMetadata | undefined
): ViewerLocation | undefined {
  if (
    !cf ||
    !("latitude" in cf) ||
    !("longitude" in cf) ||
    typeof cf?.latitude !== "string" ||
    typeof cf.longitude !== "string" ||
    !cf.latitude.trim() ||
    !cf.longitude.trim()
  ) {
    return undefined;
  }

  const coordinates = {
    latitude: Number(cf.latitude),
    longitude: Number(cf.longitude)
  };
  if (!validCoordinates(coordinates)) return undefined;

  const city = optionalLabel(cf.city);
  const region = optionalLabel(cf.region);
  const country = optionalLabel(cf.country);

  return {
    coordinates,
    source: "cloudflare",
    precision: "approximate",
    ...(city ? { city } : {}),
    ...(region ? { region } : {}),
    ...(country ? { country } : {})
  };
}
