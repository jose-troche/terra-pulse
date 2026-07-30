# Terra Pulse - Living Earth Intelligence Dashboard

## Evolution of the Idea

The original concept was:

> **"A dashboard showing the state of Earth using public data."**

However, a static dashboard is not very differentiated. Many projects can display maps, charts, and APIs.

The stronger evolution is:

> **"An AI-powered Earth Intelligence Platform that continuously observes Earth, connects independent signals, and explains how natural events affect people, infrastructure, and ecosystems."**

The system is not just showing data. It is building an evolving understanding of what is happening.

Examples:

```
Earthquake
    ↓
Population exposure
    ↓
Infrastructure impact
    ↓
Weather conditions
    ↓
Response difficulty
```

or

```
Wildfire detected
    ↓
Wind direction
    ↓
Air quality impact
    ↓
Nearby population
    ↓
Evacuation risk
```

---

# The Problem

The Earth produces enormous amounts of public data:

* earthquakes
* storms
* wildfires
* floods
* climate anomalies
* air quality changes
* ocean events
* volcanic activity

However, this information is fragmented across dozens of agencies.

A person, researcher, journalist, government worker, or humanitarian organization must manually combine:

* NASA data
* NOAA data
* USGS data
* weather models
* geographic information
* population information

The problem:

> **There is no unified intelligence layer that explains what is happening, where it is happening, and why it matters.**

---

# The Solution

A real-time AI Earth Intelligence Platform.

It continuously collects public Earth observation data, normalizes it, correlates events, estimates impacts, and presents insights through an interactive globe.

Users can ask:

> "What is happening around the world today?"

or:

> "What are the potential impacts of this earthquake?"

or:

> "Show me environmental risks developing this week."

---

# Live Data Sources

The project intentionally uses authoritative, free sources.

## 1. Earthquakes

### USGS Earthquake API

Provides:

* magnitude
* location
* depth
* time
* tsunami indicators

Latency:

~minutes

Example:

```
Magnitude 7.4 earthquake
Japan
Depth 20km
Population nearby: 3.2M
```

---

## 2. Weather and Severe Weather

### NOAA Weather API

Provides:

* hurricanes
* storms
* warnings
* floods
* extreme weather

Latency:

minutes

Example:

```
Hurricane approaching Florida

+
Population density

+
Storm surge

=

High impact region
```

---

## 3. Natural Events

### NASA EONET

Provides:

* wildfires
* volcanoes
* storms
* floods
* dust storms
* sea ice events

Latency:

minutes-hours

---

## 4. Wildfires

### NASA FIRMS

Provides:

* satellite fire detections
* fire locations
* intensity

Latency:

hours

---

## 5. Climate / Forecast Data

### Open-Meteo

Provides:

* forecasts
* temperature
* precipitation
* wind
* air quality

The implemented global air-quality layer samples a bounded set of major cities
in one batched request and creates events only when modeled US AQI is at least
101. These are CAMS model signals, not local monitor observations.

---

## 6. Drought Alerts

### GDACS

Provides:

* recently updated drought alerts
* alert severity
* affected-country context
* approximate event centroids

---

## 7. Humanitarian Information

### ReliefWeb API

Provides:

* humanitarian reports
* disaster response information

---

## 8. Geographic Context

### Natural Earth / OpenStreetMap

Provides:

* country boundaries
* cities
* roads
* geographic layers

---

## 9. Population Context

### World Bank / WorldPop

Provides:

* population density
* demographic information

---

# Example User Experience

## Home Screen

Interactive 3D globe.

Layers:

```
☑ Earthquakes
☑ Wildfires
☑ Hurricanes
☑ Volcanoes
☑ Floods
☑ Air Quality
☑ Climate anomalies
```

Events appear dynamically.

---

# User clicks an earthquake

A side panel opens:

```
Japan Earthquake

Magnitude:
7.4

Detected:
8 minutes ago

Depth:
20 km


Potential Impact

Population exposed:
2.8M

Nearby hospitals:
34

Weather:
Heavy rain expected

Risk Level:
HIGH
```

---

# AI Explanation

Instead of raw numbers:

> "This earthquake has elevated humanitarian risk because it occurred near a dense population center, several hospitals are within 50 km, and heavy rainfall may complicate emergency response."

---

# Timeline View

Shows how understanding evolves.

```
10:02
Earthquake detected

10:08
Tsunami advisory issued

10:25
Population impact calculated

11:10
Weather risk added

12:30
Humanitarian report received
```

---

# Main UI Components

## 1. Interactive Earth Map

Technology:

* Lightweigh yet rich and free mapping client

Features:

* zoom
* layers
* event clusters
* animations

---

## 2. Event Timeline

Shows:

* new events
* event evolution
* severity changes

---

## 3. Intelligence Panel

AI-generated explanation:

```
What happened?
Why does it matter?
What could happen next?
```

---

## 4. Risk Dashboard

Cards:

```
Active Events

12 Earthquakes
8 Wildfires
5 Storm Systems
3 Flood Risks
```

---

## 5. Ask Earth AI

Natural language:

> "Which areas have increasing wildfire risk?"

The system queries its knowledge graph and generates an answer.

---

# Backend Architecture

Everything deployed inside **one Cloudflare Worker**, but logically separated.

```
                 Cloudflare Worker

                     API Gateway

                          |
        -------------------------------------

              Event Collection Layer

        -------------------------------------

 USGS       NOAA       NASA       Open-Meteo
   |          |          |             |

        -------------------------------------

             Data Normalization Layer

        -------------------------------------

              Event Model

        -------------------------------------

             Earth Intelligence Engine

        -------------------------------------

 Rules Engine
      |
 Impact Calculator
      |
 Relationship Graph
      |
 AI Explanation Generator

        -------------------------------------

              Storage Layer

        -------------------------------------

 D1 Database
 KV Cache
 Durable Objects

        -------------------------------------

              Web Application

        -------------------------------------

 React UI
 Globe
 Timeline
 Dashboards
 AI Assistant
```

---

# Internal Components

## Data Collectors

Scheduled Cloudflare Cron jobs.

Examples:

```
every 5 minutes:
    fetch earthquakes

every 15 minutes:
    fetch weather alerts

every hour:
    fetch wildfire data
```

---

## Event Normalizer

Converts everything into a common model:

```json
{
"type":"earthquake",
"location":"Japan",
"time":"2026-07-18T10:02",
"severity":7.4,
"coordinates":[...]
}
```

---

## Intelligence Engine

Creates relationships:

```
Event

+

Location

+

Population

+

Weather

+

Infrastructure

=

Impact Estimate
```

---

## Knowledge Graph

Stores relationships:

```
Earthquake

connected to:

- cities
- roads
- hospitals
- population
- weather
- historical events
```

---

## AI Reasoning Layer

Uses Cloudflare free tier LLM to:

* summarize
* explain
* answer questions
* generate narratives

The AI does **not invent facts**.

It explains structured findings.
