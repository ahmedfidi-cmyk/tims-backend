# LAHTHA & CLICK — Backend

Phase 1 bootstrap implementing [Workstream 1](../docs/architecture/README.md#phase-1-implementation-roadmap) of the architecture roadmap: repo skeleton + MongoDB + migration tooling + health endpoint + CI.

> **Stack note**: implementation uses **Node.js 20 + TypeScript + Express + MongoDB (Mongoose) + migrate-mongo**, matching the existing repo's tooling. The architecture docs under [`../docs/architecture/`](../docs/architecture/) currently describe a PostgreSQL design — a docs-alignment pass is tracked as a follow-up.

This workspace lives alongside the existing weather/CV code in this repository without touching it.

## Setup

```bash
cd lahtha-click
npm install
cp .env.example .env
# edit .env if your local MongoDB is not on the default URI
```

## Database migrations

The baseline migration creates the `sync_events` collection (the LAHTHA ↔ CLICK event bus) with required indexes.

```bash
npm run migrate:status   # see pending migrations
npm run migrate:up       # apply all pending
npm run migrate:down     # revert the last
npm run migrate:create   # scaffold a new migration
```

## Running

```bash
npm run dev       # tsx watch
npm run build     # compile TS to dist/
npm start         # run compiled
```

Endpoints:
- `GET /health` — liveness; always 200 if the process is up.
- `GET /ready`  — readiness; 200 only when MongoDB is connected.

## Testing

```bash
npm test          # vitest one-shot
npm run test:watch
```

The test suite does not require a running MongoDB instance (only the bootstrap app + correlation middleware are tested in Workstream 1).

## Observability (Workstream 1 baseline)

- Structured JSON logs via `pino`.
- Every request emits one log line; `correlationId` is included.
- Correlation IDs accepted from the `x-correlation-id` header or generated as UUIDv4.
- Prometheus metrics + OpenTelemetry tracing are out of scope for Workstream 1; tracked for a follow-up.

## Layout

```
lahtha-click/
├── src/
│   ├── server.ts           # bootstrap: connect DB, start HTTP, graceful shutdown
│   ├── app.ts              # Express app factory
│   ├── config/             # zod-validated env loader
│   ├── lib/                # cross-cutting (db, logger)
│   ├── middleware/         # correlation id, error handler
│   ├── routes/             # health + readiness
│   └── domains/            # lahtha/ + click/ — populated by Workstream 2+
├── migrations/             # migrate-mongo migrations (CommonJS)
└── tests/                  # vitest
```

## Workstream 1 acceptance criteria
- [x] Repo skeleton (TS strict, ES2022, NodeNext)
- [x] MongoDB connection wired (Mongoose)
- [x] migrate-mongo configured with baseline migration
- [x] Health + readiness endpoints
- [x] Structured logging + correlation IDs
- [x] CI pipeline runs build, tests, and migrations against a real MongoDB
