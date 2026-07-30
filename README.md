# Terra Pulse

Terra Pulse is a living Earth intelligence dashboard. It connects authoritative
public observations, normalizes independent signals, computes transparent
context, and explains why an event may matter without presenting estimates as
facts.

**Live:** [terrapulse.troche.workers.dev](https://terrapulse.troche.workers.dev)

The application is a TypeScript monorepo deployed as one Cloudflare Worker:

```text
apps/
  web/                 React + Vite + MapLibre 3D globe
  worker/              Worker API, collectors, context, and Ask Earth
packages/
  earth-domain/        Shared event, risk, evidence, and graph rules
migrations/            D1 schema and event history
```

## What works

- Six live collection feeds: USGS earthquakes, USGS elevated volcano alerts,
  NASA EONET natural events, NOAA/NWS alerts, Open-Meteo/Copernicus CAMS air
  quality, and GDACS drought alerts
- Open-Meteo weather and air-quality context for a selected event
- OpenStreetMap hospital proximity counts with explicit coverage limits
- Interactive MapLibre globe, event layers, search, filters, and priority feed
- Selected-event briefs answering what happened, why it matters, and what may
  happen next
- Evidence inspection, event timeline, and a compact relationship graph
- Ask Earth with deterministic answers and an evidence-constrained Workers AI
  explanation layer
- KV source caching, D1 event history, a SQLite-backed Durable Object per Ask
  Earth session, and scheduled refresh
- Clearly labeled demonstration data if every live event source is unavailable

## Local development

Requirements: Node.js 22 or newer and a free Cloudflare account for remote
Workers AI calls.

```bash
npm install
npm run db:migrate:local
npm run dev
```

The web application runs at `http://localhost:5173`; Vite proxies `/api` to the
Worker on port `8787`. Static source feeds, D1, KV, and Durable Objects work
locally. Workers AI is a remote binding; if it is unavailable, Ask Earth returns
the deterministic evidence-based answer.

## Validation

```bash
npm run typecheck
npm test
npm run build
npm run deploy:dry
npx playwright install chromium
npm run test:e2e
```

`npm run check` runs generated binding types, TypeScript, unit tests, the
production client build, and a Wrangler dry run.

## Free-tier Cloudflare setup

The production `terrapulse-db` D1 database and `terrapulse-cache` KV namespace
are bound in `wrangler.jsonc`. Apply migrations and deploy with:

```bash
npm run db:migrate:remote
npm run deploy
```

For deployment from a different Cloudflare account, create resources with
`npx wrangler d1 create terrapulse-db` and
`npx wrangler kv namespace create terrapulse-cache`, then replace their IDs in
`wrangler.jsonc`.

The Worker automatically creates the SQLite-backed `EarthSession` Durable
Object namespace and binds Workers AI. No secret or paid data API is required.
Static asset requests bypass Worker invocation. The six collectors run in
parallel and use source-specific KV TTLs; the air-quality collector batches its
global reference cities into one request, while static volcano coordinates are
cached for one day. The 15-minute cadence, bounded event persistence, cache
TTLs, and compact AI prompts are designed for the Workers, D1, KV, Durable
Objects, and Workers AI free allocations.

See [architecture.md](docs/architecture.md) for the system design and
[methodology.md](docs/methodology.md) for evidence and risk semantics.
