import type { EarthEvent } from "@terra-pulse/earth-domain";
import { ChevronRight } from "lucide-react";
import { eventColors, eventLabels, relativeTime } from "../lib/format";
import { EventIcon } from "./Icons";
import { RiskPill } from "./RiskPill";

interface EventCardProps {
  event: EarthEvent;
  selected?: boolean;
  onSelect: (eventId: string) => void;
}

export function EventCard({ event, selected, onSelect }: EventCardProps) {
  return (
    <button
      className={`event-card ${selected ? "is-selected" : ""}`}
      type="button"
      onClick={() => onSelect(event.id)}
      aria-pressed={selected}
      style={{ "--event-color": eventColors[event.type] } as React.CSSProperties}
    >
      <span className="event-card-icon">
        <EventIcon type={event.type} size={17} />
      </span>
      <span className="event-card-copy">
        <span className="event-card-meta">
          {eventLabels[event.type].replace(/s$/, "")}
          <i aria-hidden="true" />
          {relativeTime(event.updatedAt)}
        </span>
        <strong>{event.title}</strong>
        <small>{event.location}</small>
        <RiskPill level={event.riskLevel} />
      </span>
      <ChevronRight className="event-card-arrow" size={16} aria-hidden="true" />
    </button>
  );
}
