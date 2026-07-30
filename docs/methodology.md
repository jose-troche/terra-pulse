# Intelligence Methodology

Terra Pulse separates four kinds of information:

- **Observed** — a value published by an identified source, such as an USGS
  magnitude, an NWS alert, or point weather from Open-Meteo.
- **Computed** — a reproducible transformation, such as distance to a reference
  city, mapped hospital count, normalized risk score, or relationship edge.
- **Inferred** — a cautious monitoring implication derived from structured
  signals, such as elevated wind overlapping a wildfire record.
- **Unknown** — an answer the connected packet cannot support, including
  casualties, damage, displacement, evacuation need, and response capacity.

## Monitoring priority

The risk value is a queueing aid, not a prediction. Earthquake priority combines
magnitude, depth, and a source tsunami indicator. Other event families start
from a type baseline and may increase with agency severity language. The stable
bands are:

| Score | Label |
| --- | --- |
| 82–100 | Critical |
| 62–81 | High |
| 36–61 | Moderate |
| 0–35 | Low |

## Population and infrastructure

Population context is great-circle proximity to a checked-in set of major
reference cities. The summed population describes people represented by those
cities inside the radius; it is not an exposed population estimate.

Hospital context counts OpenStreetMap features tagged `amenity=hospital` within
50 km. Mapping completeness, duplicate features, facility capacity, road
access, and operational status are not established.

## AI boundary

Deterministic code creates the evidence packet and an answer before any model is
called. Workers AI receives only that packet, a bounded question, and a short
session history. Its system instruction forbids invented impact, casualty,
damage, exposure, infrastructure, or forecast claims. Model failure falls back
to the deterministic answer.

## Source limitations

- USGS earthquake latency is typically minutes, but event review can change
  magnitude, depth, and status.
- USGS elevated-volcano records cover volcanoes monitored by participating
  United States observatories; they are not a complete global eruption census.
- EONET geometry can be approximate and event categories have uneven latency.
- NWS alerts cover the United States and some territories, not the world.
- Open-Meteo/Copernicus CAMS air-quality events are modeled regional guidance
  sampled at a fixed set of global reference cities. They are not local monitor
  readings and do not provide complete global coverage.
- GDACS drought records use alert centroids and recently updated episodes;
  affected areas are much larger than the plotted point.
- Open-Meteo point conditions do not prove event impact. Air-quality data must
  be attributed to Open-Meteo and the Copernicus Atmosphere Monitoring Service
  (CAMS).
- OpenStreetMap coverage varies by place.
- ReliefWeb, FIRMS, WorldPop, and detailed road-network ingestion are
  integration points, not claimed as live in the current release.
