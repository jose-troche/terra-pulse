import type { EventType } from "@terra-pulse/earth-domain";

export const eventTypes: EventType[] = [
  "earthquake",
  "wildfire",
  "storm",
  "flood",
  "volcano",
  "air_quality",
  "climate"
];

export const eventIconPaths: Record<EventType, string[]> = {
  earthquake: [
    "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"
  ],
  wildfire: [
    "M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"
  ],
  storm: [
    "M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973",
    "m13 12-3 5h4l-3 5"
  ],
  flood: [
    "M2 12q2.5 2 5 0t5 0 5 0 5 0",
    "M2 19q2.5 2 5 0t5 0 5 0 5 0",
    "M2 5q2.5 2 5 0t5 0 5 0 5 0"
  ],
  volcano: ["m8 3 4 8 5-5 5 15H2L8 3z"],
  air_quality: [
    "M12.8 19.6A2 2 0 1 0 14 16H2",
    "M17.5 8a2.5 2.5 0 1 1 2 4H2",
    "M9.8 4.4A2 2 0 1 1 11 8H2"
  ],
  climate: [
    "M12 2v2",
    "M12 8a4 4 0 0 0-1.645 7.647",
    "M2 12h2",
    "M20 14.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z",
    "m4.93 4.93 1.41 1.41",
    "m6.34 17.66-1.41 1.41"
  ]
};
