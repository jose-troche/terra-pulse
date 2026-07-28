export function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'",
      "x-content-type-options": "nosniff"
    }
  });
}

export function errorResponse(
  message: string,
  status: number,
  code: string
): Response {
  return json({ error: message, code }, status);
}

export async function readJsonObject(
  request: Request
): Promise<Record<string, unknown> | undefined> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 16_384) return undefined;
  const value = await request.json().catch(() => undefined);
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
