import { DurableObject } from "cloudflare:workers";
import type {
  AskEarthResponse,
  EventDetailResponse,
  EventListResponse
} from "@terra-pulse/earth-domain";

interface SessionHistoryItem {
  question: string;
  answer: string;
  at: string;
}

interface SessionRequest {
  question: string;
  deterministic: AskEarthResponse;
  detail?: EventDetailResponse;
  overview: EventListResponse;
}

function aiText(result: unknown): string | undefined {
  if (
    result &&
    typeof result === "object" &&
    "response" in result &&
    typeof result.response === "string"
  ) {
    return result.response.trim();
  }
  return undefined;
}

export class EarthSession extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }
    const payload = (await request.json()) as SessionRequest;
    const history =
      (await this.ctx.storage.get<SessionHistoryItem[]>("history")) ?? [];
    let answer = payload.deterministic.answer;
    let generatedBy: AskEarthResponse["generatedBy"] = "rules";
    try {
      const evidence = payload.detail
        ? {
            event: payload.detail.event,
            evidence: payload.detail.evidence,
            brief: payload.detail.brief,
            timeline: payload.detail.timeline
          }
        : {
            status: payload.overview.status,
            events: payload.overview.events.slice(0, 12),
            sources: payload.overview.sources
          };
      const result = await this.env.AI.run(
        "@cf/meta/llama-3.1-8b-instruct-fast",
        {
          messages: [
            {
              role: "system",
              content:
                "You are Terra Pulse, an Earth intelligence explainer. Use only the supplied JSON evidence. Never invent casualties, damage, exposure, forecasts, or infrastructure. Clearly distinguish observations from computations and uncertainty. Answer in at most 110 words. If the evidence cannot answer, say what is unknown."
            },
            {
              role: "user",
              content: JSON.stringify({
                question: payload.question,
                evidence,
                recentConversation: history.slice(-3)
              })
            }
          ],
          max_tokens: 180,
          temperature: 0.2
        }
      );
      const candidate = aiText(result);
      if (candidate) {
        answer = candidate;
        generatedBy = "workers-ai";
      }
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "workers_ai_fallback",
          message: error instanceof Error ? error.message : "Unknown error"
        })
      );
    }
    const nextHistory = [
      ...history.slice(-5),
      { question: payload.question, answer, at: new Date().toISOString() }
    ];
    await this.ctx.storage.put("history", nextHistory);
    return Response.json({
      ...payload.deterministic,
      answer,
      generatedBy
    } satisfies AskEarthResponse);
  }
}
