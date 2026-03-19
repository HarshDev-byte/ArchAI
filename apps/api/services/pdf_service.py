"""
services/pdf_service.py

PDF report generation using WeasyPrint + Jinja2.

Entrypoint
----------
generate_pdf(project_id, user_id) → signed_url: str

This function is *synchronous* — call it via asyncio.to_thread() from async routes.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Template is resolved relative to this file's parent's parent (apps/api/)
_TEMPLATE_DIR = Path(__file__).parent.parent / "templates"


# ──────────────────────────────────────────────────────────────
# Jinja2 environment
# ──────────────────────────────────────────────────────────────

def _make_jinja_env():
    try:
        from jinja2 import Environment, FileSystemLoader, select_autoescape  # type: ignore
    except ImportError as exc:
        raise RuntimeError("jinja2 not installed — pip install jinja2") from exc

    return Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )


# ──────────────────────────────────────────────────────────────
# Data fetch helpers
# ──────────────────────────────────────────────────────────────

def _get_supabase():
    from supabase import create_client  # type: ignore
    from config import get_settings
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)


def _fetch_project(db, project_id: str, user_id: str) -> dict[str, Any]:
    resp = (
        db.table("projects")
        .select("*")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise ValueError(f"Project '{project_id}' not found or access denied.")
    return resp.data


def _fetch_feasibility(db, project_id: str) -> dict[str, Any] | None:
    resp = (
        db.table("feasibility_reports")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


def _fetch_layouts(db, project_id: str) -> list[dict[str, Any]]:
    resp = (
        db.table("layout_configurations")
        .select("*")
        .eq("project_id", project_id)
        .order("design_seed")
        .execute()
    )
    return resp.data or []


# ──────────────────────────────────────────────────────────────
# Template context builders
# ──────────────────────────────────────────────────────────────

def _format_date(dt_str: str | None) -> str:
    if not dt_str:
        return datetime.now(timezone.utc).strftime("%d %B %Y")
    try:
        from dateutil import parser  # type: ignore
        dt = parser.parse(dt_str)
        return dt.strftime("%d %B %Y")
    except Exception:
        return dt_str.split("T")[0]


def _build_context(
    project: dict[str, Any],
    feasibility: dict[str, Any] | None,
    layouts: list[dict[str, Any]],
    user_id: str,
) -> dict[str, Any]:
    n_layouts = len(layouts)
    # Pages: cover + exec summary + plot analysis + 1 per layout + financials + disclaimer
    total_pages = 3 + n_layouts + 2

    return {
        "project":       project,
        "feasibility":   feasibility,
        "layouts":       layouts,
        "user_id":       user_id,
        "generated_at":  datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M UTC"),
        "total_pages":   total_pages,
    }


# ──────────────────────────────────────────────────────────────
# Rendering
# ──────────────────────────────────────────────────────────────

def _render_html(context: dict[str, Any]) -> str:
    env = _make_jinja_env()
    template = env.get_template("report.html")
    return template.render(**context)


def _html_to_pdf(html: str) -> bytes:
    try:
        from weasyprint import HTML, CSS  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "weasyprint not installed — pip install weasyprint"
        ) from exc

    # WeasyPrint uses the base_url to resolve relative assets (fonts, etc.)
    base_url = str(_TEMPLATE_DIR)
    pdf_bytes = HTML(string=html, base_url=base_url).write_pdf()
    return pdf_bytes


# ──────────────────────────────────────────────────────────────
# Storage upload (reuse geometry_service helper if available)
# ──────────────────────────────────────────────────────────────

def _upload_pdf(pdf_bytes: bytes, project_id: str) -> str:
    try:
        from services.geometry_service import _upload_and_sign  # type: ignore
    except ImportError:
        # Inline fallback (same logic)
        from supabase import create_client  # type: ignore
        from config import get_settings

        def _upload_and_sign(file_bytes, storage_path, content_type, bucket="exports"):  # type: ignore
            s = get_settings()
            db = create_client(s.supabase_url, s.supabase_service_role_key)
            try:
                db.storage.from_(bucket).upload(
                    path=storage_path,
                    file=file_bytes,
                    file_options={"content-type": content_type, "upsert": "true"},
                )
            except Exception as exc:
                logger.warning("Storage upload (fallback): %s", exc)
            res = db.storage.from_(bucket).create_signed_url(
                path=storage_path,
                expires_in=86_400,
            )
            return res["signedURL"]

    storage_path = f"reports/{project_id}/report.pdf"
    return _upload_and_sign(
        pdf_bytes,
        storage_path,
        content_type="application/pdf",
        bucket="exports",
    )


# ──────────────────────────────────────────────────────────────
# Public entrypoint
# ──────────────────────────────────────────────────────────────

def generate_pdf(project_id: str, user_id: str) -> str:
    """
    Full pipeline: fetch → render → PDF bytes → upload → signed URL.

    Parameters
    ----------
    project_id : str  — Supabase project UUID
    user_id    : str  — authenticated user UUID (for ownership check)

    Returns
    -------
    str : Supabase Storage signed URL valid for 24 hours.

    Raises
    ------
    ValueError    — project not found / access denied
    RuntimeError  — missing dependency or storage failure
    """
    logger.info("PDF generation started: project=%s user=%s", project_id, user_id)

    db          = _get_supabase()
    project     = _fetch_project(db, project_id, user_id)
    feasibility = _fetch_feasibility(db, project_id)
    layouts     = _fetch_layouts(db, project_id)

    logger.info(
        "Fetched data: feasibility=%s  layouts=%d",
        bool(feasibility), len(layouts),
    )

    context  = _build_context(project, feasibility, layouts, user_id)
    html     = _render_html(context)
    pdf_bytes = _html_to_pdf(html)

    logger.info("PDF rendered: %d bytes", len(pdf_bytes))

    signed_url = _upload_pdf(pdf_bytes, project_id)
    logger.info("PDF uploaded: project=%s  url=%s", project_id, signed_url[:60])

    return signed_url
