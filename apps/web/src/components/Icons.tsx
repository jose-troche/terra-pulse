import {
  Activity,
  CloudLightning,
  Flame,
  Mountain,
  ThermometerSun,
  Waves,
  Wind
} from "lucide-react";
import type { EventType } from "@terra-pulse/earth-domain";

interface EventIconProps {
  type: EventType;
  size?: number;
  strokeWidth?: number;
}

export function EventIcon({
  type,
  size = 16,
  strokeWidth = 1.8
}: EventIconProps) {
  const props = { size, strokeWidth, "aria-hidden": true };
  if (type === "earthquake") return <Activity {...props} />;
  if (type === "wildfire") return <Flame {...props} />;
  if (type === "storm") return <CloudLightning {...props} />;
  if (type === "flood") return <Waves {...props} />;
  if (type === "volcano") return <Mountain {...props} />;
  if (type === "air_quality") return <Wind {...props} />;
  return <ThermometerSun {...props} />;
}

export function TerraMark() {
  return (
    <svg
      className="terra-mark"
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="terra-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b8f7d7" />
          <stop offset="0.55" stopColor="#5ce0b3" />
          <stop offset="1" stopColor="#3ba8db" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="17" fill="none" stroke="url(#terra-gradient)" strokeWidth="1.3" />
      <path
        d="M8 23c5-1 7-7 11-8 4-1 5 3 9 2 2-.4 3-2 4-4M10 29c4-3 8-2 11-4 4-2 6-7 9-11"
        fill="none"
        stroke="url(#terra-gradient)"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <circle cx="19" cy="15" r="2.4" fill="#71e7bd" />
      <circle cx="28" cy="17" r="1.5" fill="#58bed5" />
    </svg>
  );
}
