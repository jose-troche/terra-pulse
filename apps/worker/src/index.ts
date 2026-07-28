/// <reference path="./worker-configuration.d.ts" />
import type { AskEarthRequest } from "@terra-pulse/earth-domain";
import { EarthSession } from "./earth-session";
import { errorResponse, json, readJsonObject } from "./http";
import { deterministicAnswer } from "./services/ask";
import { eventDetail } from "./services/detail";
import {
  collectEvents,
  filterEvents,
  persistEvents
} from "./services/events";

export { EarthSession };

const API_PREFIX = "/api/";

function eventIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/api\/events\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function sessionId(value: unknown): string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(value)
    ? value
    : crypto.randomUUID();
}

async function routeApi(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/health") {
    return json({
      status: "ok",
      service: "terra-pulse",
      now: new Date().toISOString()
    });
  }
  if (request.method === "GET" && url.pathname === "/api/events") {
    const response = await collectEvents(env);
    return json(filterEvents(response, url));
  }
  if (request.method === "GET" && url.pathname === "/api/sources") {
    const response = await collectEvents(env);
    return json({ sources: response.sources, generatedAt: response.generatedAt });
  }
  const eventId = eventIdFromPath(url.pathname);
  if (request.method === "GET" && eventId) {
    const detail = await eventDetail(env, eventId);
    return detail
      ? json(detail)
      : errorResponse("Event not found in the current source packet.", 404, "EVENT_NOT_FOUND");
  }
  if (request.method === "POST" && url.pathname === "/api/ask") {
    const body = await readJsonObject(request);
    const question =
      typeof body?.question === "string" ? body.question.trim() : "";
    if (question.length < 3 || question.length > 500) {
      return errorResponse(
        "Ask a question between 3 and 500 characters.",
        400,
        "INVALID_QUESTION"
      );
    }
    const askRequest: AskEarthRequest = {
      question,
      ...(typeof body?.eventId === "string" ? { eventId: body.eventId } : {}),
      ...(typeof body?.sessionId === "string"
        ? { sessionId: body.sessionId }
        : {})
    };
    const overview = await collectEvents(env);
    const detail = askRequest.eventId
      ? await eventDetail(env, askRequest.eventId)
      : undefined;
    if (askRequest.eventId && !detail) {
      return errorResponse(
        "The selected event is no longer in the current packet.",
        404,
        "EVENT_NOT_FOUND"
      );
    }
    const id = sessionId(askRequest.sessionId);
    const deterministic = deterministicAnswer(
      askRequest.question,
      overview,
      id,
      detail
    );
    const objectId = env.EARTH_SESSIONS.idFromName(id);
    const object = env.EARTH_SESSIONS.get(objectId);
    return object.fetch("https://earth-session.internal/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: askRequest.question,
        deterministic,
        overview,
        ...(detail ? { detail } : {})
      })
    });
  }
  return errorResponse("API route not found.", 404, "NOT_FOUND");
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(API_PREFIX)) {
      return env.ASSETS.fetch(request);
    }
    try {
      return await routeApi(request, env, ctx);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "request_failed",
          method: request.method,
          path: url.pathname,
          message: error instanceof Error ? error.message : "Unknown error"
        })
      );
      return errorResponse(
        "Terra Pulse could not complete this request. Please retry.",
        502,
        "UPSTREAM_FAILURE"
      );
    }
  },
  async scheduled(_controller, env, ctx): Promise<void> {
    ctx.waitUntil(
      collectEvents(env).then((response) => persistEvents(env, response.events))
    );
  }
} satisfies ExportedHandler<Env>;
