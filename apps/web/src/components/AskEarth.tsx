import { useState, type FormEvent } from "react";
import type { AskEarthResponse } from "@terra-pulse/earth-domain";
import { ArrowUp, Bot, Sparkles } from "lucide-react";
import { askEarth } from "../lib/api";

interface AskEarthProps {
  eventId?: string;
  compact?: boolean;
}

const suggestions = [
  "What is happening around the world today?",
  "Which areas show elevated wildfire risk?",
  "What is known versus estimated?"
];

export function AskEarth({ eventId, compact = false }: AskEarthProps) {
  const [question, setQuestion] = useState("");
  const [sessionId, setSessionId] = useState<string>();
  const [answer, setAnswer] = useState<AskEarthResponse>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async (value: string) => {
    const next = value.trim();
    if (next.length < 3 || loading) return;
    setQuestion(next);
    setLoading(true);
    setError(undefined);
    try {
      const response = await askEarth({
        question: next,
        ...(eventId ? { eventId } : {}),
        ...(sessionId ? { sessionId } : {})
      });
      setAnswer(response);
      setSessionId(response.sessionId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to ask Earth right now."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(question);
  };

  return (
    <section className={`ask-earth ${compact ? "ask-earth-compact" : ""}`}>
      <div className="ask-heading">
        <span className="ask-icon">
          <Sparkles size={14} />
        </span>
        <div>
          <strong>Ask Earth</strong>
          <small>Evidence-aware intelligence</small>
        </div>
      </div>
      {!compact && !answer ? (
        <div className="ask-suggestions">
          {suggestions.slice(eventId ? 2 : 0).map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              onClick={() => void submit(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      {answer ? (
        <div className="ask-answer" aria-live="polite">
          <div className="ask-answer-meta">
            <Bot size={13} />
            <span>{answer.generatedBy === "workers-ai" ? "AI explained" : "Rules explained"}</span>
            <i>{answer.classification}</i>
          </div>
          <p>{answer.answer}</p>
          <small>{answer.limitations[0]}</small>
        </div>
      ) : null}
      {error ? (
        <p className="ask-error" role="alert">
          {error}
        </p>
      ) : null}
      <form onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor={`ask-earth-${eventId ?? "global"}`}>
          Ask a question about Earth events
        </label>
        <input
          id={`ask-earth-${eventId ?? "global"}`}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={eventId ? "Ask about this event…" : "Ask what Earth is telling us…"}
          maxLength={500}
        />
        <button
          type="submit"
          aria-label="Ask Earth"
          disabled={loading || question.trim().length < 3}
        >
          {loading ? <span className="button-spinner" /> : <ArrowUp size={15} />}
        </button>
      </form>
      <p className="ask-disclaimer">Answers are limited to connected evidence.</p>
    </section>
  );
}
