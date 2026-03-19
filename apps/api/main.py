"""
DesignAI — FastAPI Application Entry Point

Architecture:
  main.py                 ← you are here
  ├── routers/
  │   ├── health.py           GET  /api/v1/health
  │   ├── feasibility.py      POST /api/v1/feasibility | /feasibility/check
  │   ├── websocket.py        WS   /ws/{job_id}
  │   ├── layouts.py          POST /api/v1/layouts/generate
  │   ├── projects.py         GET/POST /api/v1/projects
  │   └── export.py           POST /api/v1/export/pdf | /gltf | /dxf
  ├── services/
  │   ├── pdf_service.py      WeasyPrint + Jinja2 report generation
  │   ├── geometry_service.py trimesh GLB + ezdxf DXF generation
  │   └── …                   Claude, layout, project services
  ├── templates/              Jinja2 HTML templates (report.html)
  ├── models/                 Pydantic domain models
  ├── utils/                  Geospatial helpers, formatters
  ├── prompts/                Claude prompt templates
  └── workers/                Celery background tasks
"""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse

from config import get_settings
from routers import health, feasibility, layouts, projects, websocket, export

# ──────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("designai")

# ──────────────────────────────────────────────────────────────
# Lifespan — startup / shutdown hooks
# ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    logger.info(
        "DesignAI API starting up  [env=%s  model=%s]",
        settings.environment,
        settings.claude_model,
    )
    yield
    logger.info("DesignAI API shutting down.")


# ──────────────────────────────────────────────────────────────
# App factory
# ──────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="DesignAI API",
        description=(
            "AI-powered architectural design platform. "
            "Draw a parcel → get AI feasibility → receive 3 building layouts "
            "with 3D geometry and PDF reports."
        ),
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        # Use orjson for faster JSON serialisation
        default_response_class=ORJSONResponse,
    )

    # ── Middleware ─────────────────────────────────────────────

    # CORS — allow the Next.js dev server and any configured app URL
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    if settings.app_url and settings.app_url not in allowed_origins:
        allowed_origins.append(settings.app_url)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Gzip responses larger than 1 KB
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    # ── Request-timing middleware ──────────────────────────────
    @app.middleware("http")
    async def add_process_time_header(request: Request, call_next) -> Response:
        start = time.perf_counter()
        response: Response = await call_next(request)
        elapsed = (time.perf_counter() - start) * 1000
        response.headers["X-Process-Time-Ms"] = f"{elapsed:.1f}"
        return response

    # ── Routers ────────────────────────────────────────────────
    API_V1 = "/api/v1"

    app.include_router(health.router, prefix=API_V1)
    app.include_router(feasibility.router, prefix=API_V1)
    app.include_router(layouts.router, prefix=API_V1)
    app.include_router(projects.router, prefix=API_V1)
    app.include_router(export.router, prefix=API_V1)

    # WebSocket at root path (no API_V1 prefix — browser WS clients connect to ws://host/ws/{job_id})
    app.include_router(websocket.router)

    # ── Root redirect ──────────────────────────────────────────
    @app.get("/", include_in_schema=False)
    async def root() -> ORJSONResponse:
        return ORJSONResponse(
            {
                "service": "designai-api",
                "version": "1.0.0",
                "docs": "/docs",
                "health": "/api/v1/health",
            }
        )

    return app


# ──────────────────────────────────────────────────────────────
# WSGI entry point
# ──────────────────────────────────────────────────────────────

app = create_app()

if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.environment == "development",
        log_level="info",
    )
