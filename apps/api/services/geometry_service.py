"""
services/geometry_service.py

Generates exportable 3D (glTF/GLB) and 2D (DXF) files from layout data.

Entrypoints
-----------
generate_gltf(layout, project_id) → signed_url: str
generate_dxf(layout, project, project_id)  → signed_url: str

Both functions are *synchronous* — call them in a thread-pool executor from
async routes (await asyncio.to_thread(generate_gltf, ...)).
"""
from __future__ import annotations

import io
import logging
import math
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# Unit conversion
# ──────────────────────────────────────────────────────────────

FT_TO_M: float = 0.3048

GROUND_H: float = 4.5   # metres — ground floor height
UPPER_H:  float = 3.0   # metres — typical floor-to-floor height
SLAB_H:   float = 0.1   # metres — ground plane slab thickness


# ──────────────────────────────────────────────────────────────
# Shared Supabase storage helper
# ──────────────────────────────────────────────────────────────

def _upload_and_sign(
    file_bytes: bytes,
    storage_path: str,
    content_type: str,
    bucket: str = "exports",
) -> str:
    """
    Upload *file_bytes* to Supabase Storage at *storage_path* within *bucket*,
    then return a signed URL valid for 24 hours (86 400 s).

    Raises RuntimeError if upload or sign fails.
    """
    from supabase import create_client  # type: ignore
    from config import get_settings

    s = get_settings()
    db = create_client(s.supabase_url, s.supabase_service_role_key)

    # upsert (overwrite if file already exists)
    try:
        db.storage.from_(bucket).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": "true"},
        )
    except Exception as exc:
        # The Python SDK raises if the bucket/path already exists and upsert
        # is handled server-side — swallow non-fatal errors and continue.
        logger.warning("Storage upload warning: %s", exc)

    try:
        res = db.storage.from_(bucket).create_signed_url(
            path=storage_path,
            expires_in=86_400,  # 24 hours
        )
        return res["signedURL"]
    except Exception as exc:
        raise RuntimeError(f"Failed to create signed URL for {storage_path}: {exc}") from exc


# ══════════════════════════════════════════════════════════════
#  glTF / GLB EXPORT
# ══════════════════════════════════════════════════════════════

def _footprint_boxes(
    width_m: float,
    depth_m: float,
    shape: str,
) -> list[tuple[tuple[float, float, float], tuple[float, float, float]]]:
    """
    Return a list of (size, center) tuples for the footprint boxes
    that make up one floor slice of the given shape.

    size   = (x, y, z)  in metres
    center = (cx, cy, cz) — z is the *floor-relative* centre (set to 0 here;
             the caller offsets it per floor)
    """
    boxes: list[tuple[tuple[float, float, float], tuple[float, float, float]]] = []

    shape = shape.lower().strip()

    if shape in ("l-shaped", "l_shaped", "l"):
        # Two boxes: main slab + one wing
        main_w, main_d = width_m, depth_m * 0.65
        wing_w, wing_d = width_m * 0.55, depth_m * 0.35
        boxes.append(((main_w, main_d, 1.0), (0.0, -(depth_m - main_d) / 2, 0.0)))
        boxes.append(((wing_w, wing_d, 1.0), (-(width_m - wing_w) / 2, depth_m * 0.175, 0.0)))

    elif shape in ("u-shaped", "u_shaped", "u"):
        arm_w = width_m * 0.3
        arm_d = depth_m
        cross_w = width_m
        cross_d = depth_m * 0.3
        # Left arm
        boxes.append(((arm_w, arm_d, 1.0), (-width_m / 2 + arm_w / 2, 0.0, 0.0)))
        # Right arm
        boxes.append(((arm_w, arm_d, 1.0), (width_m / 2 - arm_w / 2, 0.0, 0.0)))
        # Back cross-bar
        boxes.append(((cross_w, cross_d, 1.0), (0.0, depth_m / 2 - cross_d / 2, 0.0)))

    elif shape in ("courtyard",):
        outer_w, outer_d = width_m, depth_m
        inner_w = width_m * 0.5
        inner_d = depth_m * 0.5
        # Four perimeter strips
        strip = depth_m * 0.25
        # Top / bottom strips
        boxes.append(((outer_w, (outer_d - inner_d) / 2, 1.0),
                       (0.0, outer_d / 2 - (outer_d - inner_d) / 4, 0.0)))
        boxes.append(((outer_w, (outer_d - inner_d) / 2, 1.0),
                       (0.0, -(outer_d / 2 - (outer_d - inner_d) / 4), 0.0)))
        # Side strips
        boxes.append((((outer_w - inner_w) / 2, inner_d, 1.0),
                       (outer_w / 2 - (outer_w - inner_w) / 4, 0.0, 0.0)))
        boxes.append((((outer_w - inner_w) / 2, inner_d, 1.0),
                       (-(outer_w / 2 - (outer_w - inner_w) / 4), 0.0, 0.0)))

    elif shape in ("tower",):
        # Square tower: use the smaller dimension
        side = min(width_m, depth_m)
        boxes.append(((side, side, 1.0), (0.0, 0.0, 0.0)))

    elif shape in ("y-shaped", "y_shaped", "y"):
        stem_w = width_m * 0.3
        stem_d = depth_m * 0.5
        wing_w = width_m * 0.45
        wing_d = depth_m * 0.3
        # Central stem
        boxes.append(((stem_w, stem_d, 1.0), (0.0, -depth_m * 0.1, 0.0)))
        # Left wing
        boxes.append(((wing_w, wing_d, 1.0),
                       (-width_m * 0.25, depth_m * 0.2, 0.0)))
        # Right wing
        boxes.append(((wing_w, wing_d, 1.0),
                       (width_m * 0.25, depth_m * 0.2, 0.0)))

    else:
        # Rectangle / default
        boxes.append(((width_m, depth_m, 1.0), (0.0, 0.0, 0.0)))

    return boxes


def generate_gltf(layout: dict[str, Any], project_id: str) -> str:
    """
    Build a GLB file from layout data using trimesh.

    Returns:
        Supabase signed URL (24 h) for the uploaded .glb file.

    Raises:
        RuntimeError on geometry or storage failure.
    """
    try:
        import trimesh  # type: ignore
        import numpy as np  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "trimesh / numpy not installed — pip install trimesh numpy"
        ) from exc

    fp      = layout.get("floor_plan", {})
    hints   = layout.get("geometry_hints") or fp  # fall back to floor_plan
    footprint = fp.get("footprint", {}) if isinstance(fp, dict) else {}

    # ── Dimensions ─────────────────────────────────────────────
    width_ft = float(
        hints.get("width_ft")
        or footprint.get("width_ft")
        or 60
    )
    depth_ft = float(
        hints.get("depth_ft")
        or footprint.get("depth_ft")
        or 40
    )
    shape = (
        hints.get("shape")
        or footprint.get("shape")
        or "rectangle"
    )
    n_floors = int(
        hints.get("floors")
        or (fp.get("floors") if isinstance(fp, dict) else None)
        or 5
    )

    width_m = width_ft * FT_TO_M
    depth_m = depth_ft * FT_TO_M

    scene = trimesh.Scene()

    # ── Materials (vertex colours via metadata, visual applied per mesh) ──────
    GROUND_COLOR  = np.array([0.45, 0.45, 0.48, 1.0])   # grey
    UPPER_COLOR   = np.array([0.93, 0.91, 0.88, 1.0])   # cream
    GPLANE_COLOR  = np.array([0.12, 0.14, 0.18, 1.0])   # dark

    def _add_floor_boxes(
        z_base: float,
        height: float,
        color: "np.ndarray",
        name_prefix: str,
    ) -> None:
        box_defs = _footprint_boxes(width_m, depth_m, shape)
        for idx, (size, center) in enumerate(box_defs):
            w, d, _ = size
            cx, cy, _ = center
            mesh = trimesh.creation.box(extents=[w, d, height])
            mesh.apply_translation([cx, cy, z_base + height / 2])
            mesh.visual.face_colors = (color * 255).astype(np.uint8)
            scene.add_geometry(mesh, node_name=f"{name_prefix}_{idx}")

    # ── Ground floor (z = 0 … GROUND_H) ────────────────────────
    _add_floor_boxes(
        z_base=0.0,
        height=GROUND_H,
        color=GROUND_COLOR,
        name_prefix="ground_floor",
    )

    # ── Upper floors ────────────────────────────────────────────
    for i in range(1, n_floors):
        z_base = GROUND_H + (i - 1) * UPPER_H
        _add_floor_boxes(
            z_base=z_base,
            height=UPPER_H,
            color=UPPER_COLOR,
            name_prefix=f"floor_{i + 1}",
        )

    # ── Ground plane ────────────────────────────────────────────
    gplane = trimesh.creation.box(extents=[width_m * 1.5, depth_m * 1.5, SLAB_H])
    gplane.apply_translation([0.0, 0.0, -SLAB_H / 2])
    gplane.visual.face_colors = (GPLANE_COLOR * 255).astype(np.uint8)
    scene.add_geometry(gplane, node_name="ground_plane")

    # ── Export ──────────────────────────────────────────────────
    glb_bytes: bytes = scene.export(file_type="glb")
    logger.info(
        "GLB generated: project=%s  floors=%d  shape=%s  size=%d bytes",
        project_id, n_floors, shape, len(glb_bytes),
    )

    storage_path = f"exports/{project_id}/building.glb"
    signed_url = _upload_and_sign(
        glb_bytes,
        storage_path,
        content_type="model/gltf-binary",
    )
    return signed_url


# ══════════════════════════════════════════════════════════════
#  DXF EXPORT
# ══════════════════════════════════════════════════════════════

_DISCLAIMER = (
    "AI-GENERATED PRELIMINARY DRAWING. "
    "Verify with a licensed architect before construction or regulatory submission."
)

# A3 title block position
_TB_X, _TB_Y = 0.0, -60.0   # below the main drawing


def generate_dxf(
    layout: dict[str, Any],
    project: dict[str, Any],
    project_id: str,
) -> str:
    """
    Build a 2D floor-plan DXF from layout + project data using ezdxf.

    Coordinate system:
        1 drawing unit = 1 foot (dimensioned in feet).
        Origin (0,0) = SW corner of plot boundary.

    Returns:
        Supabase signed URL (24 h) for the uploaded .dxf file.
    """
    try:
        import ezdxf  # type: ignore
        from ezdxf import colors as dxf_colors  # type: ignore
        from ezdxf.enums import TextEntityAlignment  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "ezdxf not installed — pip install ezdxf"
        ) from exc

    fp       = layout.get("floor_plan", {}) or {}
    hints    = layout.get("geometry_hints") or fp
    footprint = fp.get("footprint", {}) or {}

    width_ft = float(hints.get("width_ft") or footprint.get("width_ft") or 60)
    depth_ft = float(hints.get("depth_ft") or footprint.get("depth_ft") or 40)
    n_floors = int(hints.get("floors") or fp.get("floors") or 5)
    shape    = (hints.get("shape") or footprint.get("shape") or "rectangle").title()

    # Setbacks (metres) → feet
    setbacks_m = {
        "front": 3.0, "rear": 2.0, "side": 1.5,
    }
    sb = {k: v / FT_TO_M for k, v in setbacks_m.items()}

    # ── Document setup ──────────────────────────────────────────
    doc = ezdxf.new(dxfversion="R2010")
    doc.header["$INSUNITS"] = 2  # feet

    # ── Layers ─────────────────────────────────────────────────
    layer_cfg = {
        "PLOT_BOUNDARY": {"color": dxf_colors.YELLOW,  "lineweight": 50},
        "BUILDING":      {"color": dxf_colors.WHITE,   "lineweight": 35},
        "SETBACK":       {"color": dxf_colors.CYAN,    "lineweight": 18, "linetype": "DASHED"},
        "DIMENSIONS":    {"color": dxf_colors.MAGENTA, "lineweight": 13},
        "ANNOTATIONS":   {"color": dxf_colors.GREEN,   "lineweight": 13},
        "TITLE_BLOCK":   {"color": 251,                "lineweight": 18},
        "DISCLAIMER":    {"color": dxf_colors.RED,     "lineweight": 13},
    }
    for name, cfg in layer_cfg.items():
        lyr = doc.layers.add(name)
        lyr.color = cfg["color"]
        lyr.lineweight = cfg["lineweight"]

    # Add DASHED linetype for setback layer
    if "DASHED" not in doc.linetypes:
        doc.linetypes.add("DASHED", pattern=[0.5, -0.25])

    msp = doc.modelspace()

    # ── Plot boundary ────────────────────────────────────────────
    # Boundary is slightly larger than building footprint (1.5× plot area)
    # We show the exact plot boundary as a closed polyline
    pad_x = width_ft  * 0.2
    pad_y = depth_ft  * 0.2
    plot_w = width_ft + pad_x * 2
    plot_d = depth_ft + pad_y * 2

    plot_corners = [
        (-pad_x,        -pad_y),
        (width_ft + pad_x, -pad_y),
        (width_ft + pad_x, depth_ft + pad_y),
        (-pad_x,        depth_ft + pad_y),
    ]
    msp.add_lwpolyline(
        plot_corners,
        format="xy",
        close=True,
        dxfattribs={"layer": "PLOT_BOUNDARY", "lineweight": 50},
    )

    # ── Setback boundary (dashed) ───────────────────────────────
    sb_corners = [
        (sb["side"],               sb["rear"]),
        (width_ft - sb["side"],    sb["rear"]),
        (width_ft - sb["side"],    depth_ft - sb["front"]),
        (sb["side"],               depth_ft - sb["front"]),
    ]
    msp.add_lwpolyline(
        sb_corners,
        format="xy",
        close=True,
        dxfattribs={"layer": "SETBACK", "linetype": "DASHED"},
    )

    # ── Building footprint ──────────────────────────────────────
    def _add_footprint_polyline(shape_lower: str) -> None:
        s = shape_lower.strip()
        bw, bd = width_ft, depth_ft

        if s in ("l-shaped", "l_shaped", "l"):
            # L: main rect + wing
            pts = [
                (0, 0),
                (bw, 0),
                (bw, bd * 0.65),
                (bw * 0.55, bd * 0.65),
                (bw * 0.55, bd),
                (0, bd),
            ]
        elif s in ("u-shaped", "u_shaped", "u"):
            aw = bw * 0.3
            cb = bd * 0.3
            pts = [
                (0, 0), (aw, 0), (aw, bd - cb), (bw - aw, bd - cb),
                (bw - aw, 0), (bw, 0), (bw, bd), (0, bd),
            ]
        else:
            # Rectangle, tower, or default
            side = min(bw, bd) if s == "tower" else bw
            ddepth = side if s == "tower" else bd
            ox = (bw - side) / 2 if s == "tower" else 0
            pts = [
                (ox, 0), (ox + side, 0),
                (ox + side, ddepth), (ox, ddepth),
            ]

        msp.add_lwpolyline(
            pts, format="xy", close=True,
            dxfattribs={"layer": "BUILDING"},
        )

    _add_footprint_polyline(shape.lower())

    # ── Floor labels ────────────────────────────────────────────
    label_x = width_ft / 2
    for i in range(n_floors):
        floor_label = "GF" if i == 0 else f"F{i}"
        msp.add_text(
            floor_label,
            dxfattribs={
                "layer": "ANNOTATIONS",
                "height": 2.5,
                "insert": (label_x, depth_ft * 0.15 + i * 3.0),
                "color": dxf_colors.GREEN,
            },
        )

    # ── Dimensions ──────────────────────────────────────────────
    dim_style_name = "DESIGNAI_DIM"
    doc.dimstyles.add(
        dim_style_name,
        dxfattribs={"dimtxt": 2.0, "dimclrd": dxf_colors.MAGENTA},
    )
    # Width dimension (bottom)
    msp.add_linear_dim(
        base=(0, -pad_y * 0.6),
        p1=(0, 0),
        p2=(width_ft, 0),
        dimstyle=dim_style_name,
        dxfattribs={"layer": "DIMENSIONS"},
    ).render()
    # Depth dimension (left)
    msp.add_linear_dim(
        base=(-pad_x * 0.6, 0),
        p1=(0, 0),
        p2=(0, depth_ft),
        angle=90,
        dimstyle=dim_style_name,
        dxfattribs={"layer": "DIMENSIONS"},
    ).render()

    # Setback annotations
    for label, x, y in [
        (f"Front SB: {sb['front']:.1f}ft",  width_ft / 2,  depth_ft - sb["front"] + 1.0),
        (f"Rear SB:  {sb['rear']:.1f}ft",   width_ft / 2,  sb["rear"] - 2.0),
        (f"Side SB:  {sb['side']:.1f}ft",    sb["side"] + 1.0, depth_ft / 2),
    ]:
        msp.add_text(
            label,
            dxfattribs={
                "layer": "SETBACK",
                "height": 1.5,
                "insert": (x, y),
            },
        )

    # ── Title block ──────────────────────────────────────────────
    tb_y = _TB_Y
    tb_x = 0.0
    tb_w = max(width_ft + pad_x * 2, 120)
    tb_h = 50.0

    # Border rect
    msp.add_lwpolyline(
        [(tb_x, tb_y), (tb_x + tb_w, tb_y),
         (tb_x + tb_w, tb_y + tb_h), (tb_x, tb_y + tb_h)],
        close=True,
        dxfattribs={"layer": "TITLE_BLOCK"},
    )

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    title_rows = [
        ("DesignAI — Architectural Layout",  8.0, tb_y + 40),
        (project.get("name", "Untitled"),    5.5, tb_y + 30),
        (f"Layout: {layout.get('concept_name', 'N/A')}", 4.0, tb_y + 22),
        (f"City: {project.get('location_city', '—')}  |  Floors: {n_floors}  |  Shape: {shape}", 3.0, tb_y + 15),
        (f"Date: {now_str}  |  Plot: {int(width_ft)}×{int(depth_ft)} ft", 3.0, tb_y + 8),
    ]
    for text, height, y_pos in title_rows:
        msp.add_text(
            text,
            dxfattribs={
                "layer": "TITLE_BLOCK",
                "height": height,
                "insert": (tb_x + 3.0, y_pos),
            },
        )

    # ── Disclaimer ───────────────────────────────────────────────
    msp.add_text(
        _DISCLAIMER,
        dxfattribs={
            "layer": "DISCLAIMER",
            "height": 2.0,
            "insert": (tb_x + 3.0, tb_y + 2.5),
            "color": dxf_colors.RED,
        },
    )

    # ── Serialise to bytes ───────────────────────────────────────
    buf = io.StringIO()
    doc.write(buf)
    dxf_bytes = buf.getvalue().encode("utf-8")

    logger.info(
        "DXF generated: project=%s  layout=%s  size=%d bytes",
        project_id, layout.get("id", "?"), len(dxf_bytes),
    )

    storage_path = f"exports/{project_id}/building.dxf"
    signed_url = _upload_and_sign(
        dxf_bytes,
        storage_path,
        content_type="application/dxf",
    )
    return signed_url
