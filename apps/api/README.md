# DesignAI API (FastAPI)

This folder contains the backend API for the DesignAI project.

## Key directories

- `main.py` - FastAPI app entrypoint.
- `routers/` - API route definitions (health, feasibility, layouts, projects, export, websocket).
- `services/` - Business logic (Claude integration, layout generation, geometry export, PDF rendering).
- `models/` - Pydantic domain models and DTOs.
- `prompts/` - Prompt templates used by Claude.
- `templates/` - Jinja2 templates for PDF reports.
- `utils/` - Shared helpers (geo, pricing, auth, etc.).
- `workers/` - Celery task definitions and worker helpers (preferred place for async background jobs).

## Running locally

### API server

```bash
npm run api:dev
```

### Worker (Celery)

```bash
npm run worker:dev
```

### Docker (full stack)

```bash
docker compose up --build
```

## Notes

- `legacy/` contains old placeholder Celery task setup that is no longer used by the current worker implementation.
