# DesignAI

> AI-powered architectural design platform — draw a land parcel, get an AI feasibility check, and receive 3 unique building layout configurations with 3D exports and PDF reports.

## Monorepo Structure

```
designai/
├── apps/
│   ├── web/          # Next.js 15 (App Router, TypeScript, Tailwind 4)
│   └── api/          # Python FastAPI + Celery workers
├── docker-compose.yml
├── .env.example
└── package.json      # npm workspaces root
```

## Services

| Service        | Port | Description                          |
|----------------|------|--------------------------------------|
| `web`          | 3000 | Next.js frontend                     |
| `api`          | 8000 | FastAPI REST backend                 |
| `celery-worker`| —    | Background AI task processing        |
| `celery-flower`| 5555 | Celery monitoring UI                 |
| `redis`        | 6379 | Message broker + result backend      |

## Quick Start

### 1. Prerequisites
- [Docker + Docker Compose](https://docs.docker.com/get-docker/)
- [Node.js ≥ 20](https://nodejs.org/) + npm ≥ 10
- [Python ≥ 3.12](https://www.python.org/) (for local API dev)

### 2. Setup env vars
```bash
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, MAPBOX_TOKEN, etc.
```

### 3a. Run with Docker (recommended)
```bash
npm run docker:up
```

### 3b. Run services locally
```bash
# Terminal 1 — Next.js
npm run dev

# Terminal 2 — FastAPI
npm run api:dev

# Terminal 3 — Celery worker
npm run worker:dev
```

## Tech Stack

**Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Leaflet (maps), Three.js (3D), Framer Motion, Zustand

**Backend:** Python 3.12, FastAPI, Celery, Redis, Anthropic Claude claude-sonnet-4-6, ReportLab (PDF), Shapely (geospatial)

## Development Phases

- [x] **Phase 1** — Monorepo scaffold
- [ ] **Phase 2** — Satellite map parcel drawing (Leaflet + draw tools)
- [ ] **Phase 3** — AI feasibility check (Claude claude-sonnet-4-6)
- [ ] **Phase 4** — Layout generation (3 configurations)
- [ ] **Phase 5** — 3D viewer (Three.js) + PDF export (ReportLab)
