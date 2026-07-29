import { DurableObject } from "cloudflare:workers";
import type {
  AskEarthResponse,
  EventDetailResponse,
  EventListResponse,
  RegionalRiskAnalysis
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
  regionalRisk?: RegionalRiskAnalysis;
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

function isUsefulRegionalExplanation(candidate: string): boolean {
  const normalized = candidate.toLowerCase();
  return (
    /\b(computed|cluster|source|signal|concentration)\b/.test(normalized) &&
    /\b(forecast|probability|coverage|limitation|approximation)\b/.test(
      normalized
    )
  );
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
        : payload.regionalRisk
        ? {
            method: payload.regionalRisk.method,
            clusterRadiusKm: payload.regionalRisk.clusterRadiusKm,
            analyzedEventCount: payload.regionalRisk.analyzedEventCount,
            limitations: payload.regionalRisk.limitations
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
              content: payload.regionalRisk
                ? "You are Terra Pulse, an Earth intelligence explainer. The application has already computed and displayed the ranked regions. Using only the supplied method JSON, return a brief one- or two-sentence explanation of how to interpret the computation and its main limitation. Do not name or rank regions and do not repeat counts. Describe it as computed monitoring priority, never as probability or prediction. Use at most 45 words."
                : "You are Terra Pulse, an Earth intelligence explainer. Use only the supplied JSON evidence. Never invent casualties, damage, exposure, forecasts, or infrastructure. Clearly distinguish observations from computations and uncertainty. Answer in at most 110 words. If the evidence cannot answer, say what is unknown."
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
          temperature: payload.regionalRisk ? 0.1 : 0.2
        }
      );
      const candidate = aiText(result);
      if (
        candidate &&
        (!payload.regionalRisk ||
          isUsefulRegionalExplanation(candidate))
      ) {
        answer = payload.regionalRisk
          ? `${payload.deterministic.answer} ${candidate}`
          : candidate;
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
