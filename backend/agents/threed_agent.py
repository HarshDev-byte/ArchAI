"""
3D Generation Agent — ArchAI
Delegates to blender/generator.py for headless Blender rendering.
Returns model paths, VR interaction points, walkthrough data,
and graceful fallbacks when Blender is unavailable.
"""
from __future__ import annotations

import logging
import os
import tempfile
from typing import Any

from blender.generator import (
    generate_3d_model,
    generate_all_variants,
    get_model_metadata,
)

logger = logging.getLogger(__name__)


async def generate_3d(
    design_variants: list[dict[str, Any]],
    floors: int,
    output_dir: str | None = None,
) -> dict[str, Any]:
    """
    Generate 3D .glb models for all design variants.

    Args:
        design_variants : List of variant dicts from evolve_designs().
        floors          : Number of floors.
        output_dir      : Optional directory for output files.
                          Defaults to a system temp directory.

    Returns:
        Dict with model_files, vr_assets, walkthrough_data, metadata.
    """
    if output_dir is None:
        output_dir = tempfile.mkdtemp(prefix="archai_3d_")

    try:
        # Generate all variants concurrently
        variants_with_models = await generate_all_variants(design_variants, floors)

        # Build model files list
        model_files: list[dict] = []
        for v in variants_with_models:
            path = v.get("model_path")
            meta = get_model_metadata(path) if path else {"exists": False}
            model_files.append({
                "rank": v.get("rank", 0),
                "dna_id": (v.get("dna_dict") or v.get("dna", {})).get("dna_id"),
                "glb_path": path,
                "glb_exists": meta.get("exists", False),
                "size_mb": meta.get("size_mb"),
                "error": v.get("model_error"),
            })

        primary = next((m for m in model_files if m["glb_exists"]), None)
        primary_path = primary["glb_path"] if primary else None

        return {
            "model_files": model_files,
            "primary_glb": primary_path,
            "output_dir": output_dir,
            "vr_assets": _build_vr_assets(primary_path, design_variants),
            "walkthrough_data": _build_walkthrough(design_variants, floors),
            "generation_metadata": {
                "total_variants": len(design_variants),
                "successful_models": sum(1 for m in model_files if m["glb_exists"]),
                "render_engine": "BLENDER_EEVEE",
                "format": "GLB / glTF 2.0",
            },
        }

    except FileNotFoundError as exc:
        # Blender not installed — return graceful fallback
        logger.warning("Blender unavailable: %s", exc)
        return _blender_unavailable_response(str(exc), design_variants)

    except Exception as exc:
        logger.error("3D generation failed: %s", exc, exc_info=True)
        return _blender_unavailable_response(str(exc), design_variants)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _build_vr_assets(glb_path: str | None, variants: list[dict]) -> dict:
    """Build VR/WebXR asset metadata."""
    best_dna = {}
    if variants:
        best_dna = variants[0].get("dna_dict") or variants[0].get("dna", {})

    bua = best_dna.get("built_up_area", 80)
    w = (bua ** 0.5) * 1.25
    d = (bua ** 0.5) * 0.85

    return {
        "vr_model": glb_path,
        "interaction_points": [
            {"type": "teleport", "position": [0, 0, 0],     "room": "entrance"},
            {"type": "teleport", "position": [w * 0.2, 0, 0], "room": "living"},
            {"type": "teleport", "position": [w * 0.4, d * 0.3, 0], "room": "kitchen"},
            {"type": "info",     "position": [0, d * 0.4, 0], "content": "Solar orientation optimised"},
        ],
        "navigation_mesh": glb_path.replace(".glb", "_navmesh.json") if glb_path else None,
        "optimization_stats": {
            "target_polygons_vr": 15_000,
            "texture_compression": "KTX2 / Basis Universal",
        },
    }


def _build_walkthrough(variants: list[dict], floors: int) -> dict:
    """Build camera-path walkthrough data."""
    best_dna = {}
    if variants:
        best_dna = variants[0].get("dna_dict") or variants[0].get("dna", {})

    bua = best_dna.get("built_up_area", 80)
    fh = best_dna.get("floor_height", 3.0)
    dist = (bua ** 0.5) * 2.4
    top_z = floors * fh + 5

    return {
        "camera_path": [
            {"position": [-dist, -dist * 1.1, top_z],  "target": [0, 0, floors * fh / 2], "duration": 4},
            {"position": [0,      dist * 1.5,  top_z + 3], "target": [0, 0, 0], "duration": 5},
            {"position": [dist,  -dist * 0.8,  top_z],  "target": [0, 0, floors * fh / 2], "duration": 4},
            {"position": [0,     0,            top_z + 6], "target": [0, 0, 0], "duration": 3},
        ],
        "hotspots": [
            {"position": [0, 0, 1.5],  "title": "Main Entrance",     "description": "Primary access and foyer"},
            {"position": [0, 0, top_z], "title": "Rooftop",          "description": f"Rooftop utility: {best_dna.get('rooftop_utility','terrace')}"},
        ],
        "lighting_scenarios": [
            {"name": "day",    "sun_energy": 4.0, "sky_color": [0.53, 0.81, 0.98]},
            {"name": "golden", "sun_energy": 2.5, "sky_color": [0.95, 0.70, 0.30]},
            {"name": "night",  "sun_energy": 0.1, "sky_color": [0.03, 0.04, 0.12]},
        ],
    }


def _blender_unavailable_response(error_msg: str, variants: list[dict]) -> dict:
    """Graceful response when Blender is not installed."""
    return {
        "model_files": [],
        "primary_glb": None,
        "output_dir": None,
        "vr_assets": {"vr_model": None, "interaction_points": [], "navigation_mesh": None},
        "walkthrough_data": {"camera_path": [], "hotspots": [], "lighting_scenarios": []},
        "generation_metadata": {
            "total_variants": len(variants),
            "successful_models": 0,
            "render_engine": None,
            "format": None,
        },
        "blender_unavailable": True,
        "error": error_msg,
        "setup_instructions": (
            "Install Blender 4.x from https://blender.org/download and set "
            "BLENDER_PATH in backend/.env to the full path of the blender executable."
        ),
    }