import { useState } from "react";
import type {
  EventDetailResponse,
  EvidenceClass
} from "@terra-pulse/earth-domain";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Gauge,
  Network,
  ShieldCheck,
  Users,
  Wind
} from "lucide-react";
import {
  compassDirection,
  formatPopulation,
  relativeTime
} from "../lib/format";
import { AskEarth } from "./AskEarth";
import { EventIcon } from "./Icons";
import { KnowledgeGraph } from "./KnowledgeGraph";
import { RiskPill } from "./RiskPill";

interface DetailPanelProps {
  detail: EventDetailResponse;
  onClose: () => void;
}

type DetailTab = "brief" | "evidence" | "timeline" | "connections";

const evidenceLabel: Record<EvidenceClass, string> = {
  observed: "Observed",
  computed: "Computed",
  inferred: "Inferred",
  unknown: "Unknown"
};

export function DetailPanel({ detail, onClose }: DetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>("brief");
  const { event, brief } = detail;
  return (
    <div className="detail-panel" data-testid="event-detail">
      <div className="detail-nav">
        <button type="button" onClick={onClose} className="back-button">
          <ArrowLeft size={15} />
          All signals
        </button>
        <RiskPill level={event.riskLevel} score={event.riskScore} />
      </div>

      <header className="detail-header">
        <span className={`detail-event-icon event-${event.type}`}>
          <EventIcon type={event.type} size={20} />
        </span>
        <div>
          <p>{event.type.replace("_", " ")} · {relativeTime(event.updatedAt)}</p>
          <h2>{event.title}</h2>
          <a href={event.source.url} target="_blank" rel="noreferrer">
            {event.source.name} <ExternalLink size={11} />
          </a>
        </div>
      </header>

      <div className="detail-metrics">
        <article>
          <Gauge size={15} />
          <span>Severity</span>
          <strong>{event.severity?.label ?? "Active signal"}</strong>
        </article>
        <article>
          <Users size={15} />
          <span>Population context</span>
          <strong>
            {detail.population.representedPopulation > 0
              ? formatPopulation(detail.population.representedPopulation)
              : "Unknown"}
          </strong>
        </article>
        <article>
          <Building2 size={15} />
          <span>Hospitals · 50 km</span>
          <strong>
            {detail.infrastructure.available
              ? detail.infrastructure.hospitalCount
              : "Unknown"}
          </strong>
        </article>
        <article>
          <Wind size={15} />
          <span>Point wind</span>
          <strong>
            {detail.weather.windSpeedKph === undefined
              ? "Unknown"
              : `${Math.round(detail.weather.windSpeedKph)} km/h ${compassDirection(detail.weather.windDirectionDegrees)}`}
          </strong>
        </article>
      </div>

      <nav className="detail-tabs" aria-label="Event intelligence sections">
        {(["brief", "evidence", "timeline", "connections"] as const).map(
          (item) => (
            <button
              type="button"
              key={item}
              className={tab === item ? "active" : ""}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          )
        )}
      </nav>

      <div className="detail-scroll">
        {tab === "brief" ? (
          <div className="brief-content">
            <section className="intelligence-lede">
              <div>
                <ShieldCheck size={15} />
                <span>
                  {brief.generatedBy === "workers-ai" ? "AI explanation" : "Evidence synthesis"}
                </span>
              </div>
              <h3>{brief.headline}</h3>
              <p>Generated from structured findings · {brief.confidence} confidence</p>
            </section>
            <BriefSection
              number="01"
              title="What happened?"
              text={brief.whatHappened}
              classification="observed"
            />
            <BriefSection
              number="02"
              title="Why does it matter?"
              text={brief.whyItMatters}
              classification="computed"
            />
            <BriefSection
              number="03"
              title="What could happen next?"
              text={brief.whatCouldHappenNext}
              classification="inferred"
            />
            <div className="limits-note">
              <strong>Known limits</strong>
              {brief.limitations.map((limitation) => (
                <p key={limitation}>{limitation}</p>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "evidence" ? (
          <div className="evidence-list">
            <div className="section-intro">
              <h3>Evidence packet</h3>
              <p>Every finding carries its origin and confidence.</p>
            </div>
            {detail.evidence.map((item) => (
              <article key={item.id} className="evidence-row">
                <span className={`evidence-badge evidence-${item.classification}`}>
                  {evidenceLabel[item.classification]}
                </span>
                <div>
                  <h4>{item.label}</h4>
                  <p>{item.value}</p>
                  {item.method ? <small>{item.method}</small> : null}
                  {item.sourceUrl ? (
                    <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                      {item.sourceName ?? "Source"} <ExternalLink size={10} />
                    </a>
                  ) : null}
                </div>
                <i className={`confidence-dot confidence-${item.confidence}`} title={`${item.confidence} confidence`} />
              </article>
            ))}
          </div>
        ) : null}

        {tab === "timeline" ? (
          <div className="timeline-list">
            <div className="section-intro">
              <h3>Situation timeline</h3>
              <p>How understanding of this signal has evolved.</p>
            </div>
            {detail.timeline.map((entry) => (
              <article key={entry.id} className="timeline-entry">
                <div className={`timeline-marker evidence-${entry.classification}`} />
                <time dateTime={entry.at}>
                  {new Date(entry.at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit"
                  })}
                </time>
                <h4>{entry.title}</h4>
                <p>{entry.description}</p>
                <span className={`evidence-badge evidence-${entry.classification}`}>
                  {entry.classification}
                </span>
              </article>
            ))}
          </div>
        ) : null}

        {tab === "connections" ? (
          <div className="connections-content">
            <div className="section-intro section-intro-icon">
              <Network size={16} />
              <div>
                <h3>Signal relationships</h3>
                <p>How this event connects to place, conditions, and infrastructure.</p>
              </div>
            </div>
            <KnowledgeGraph graph={detail.graph} />
          </div>
        ) : null}
      </div>
      <AskEarth eventId={event.id} compact />
    </div>
  );
}

function BriefSection({
  number,
  title,
  text,
  classification
}: {
  number: string;
  title: string;
  text: string;
  classification: EvidenceClass;
}) {
  return (
    <section className="brief-section">
      <div className="brief-section-heading">
        <span>{number}</span>
        <h3>{title}</h3>
        <i className={`evidence-badge evidence-${classification}`}>
          {classification}
        </i>
      </div>
      <p>{text}</p>
    </section>
  );
}
