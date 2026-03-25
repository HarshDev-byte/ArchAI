"""
Blender 3D Model Generator — ArchAI
====================================
Takes a Design DNA dict, generates a Blender Python script from a template,
runs Blender headlessly, and exports a .glb file for web viewing.

Architecture:
  generate_3d_model()       — single variant, returns .glb path
  generate_all_variants()   — all 5 variants concurrently via asyncio.gather
  _build_blender_script()   — pure function: DNA dict → Blender Python string
  _run_blender()            — async subprocess wrapper with 120s timeout

Design notes:
  - All geometry is procedurally generated from DNA data (no baked assets)
  - Blender script runs inside Blender's embedded Python — not the host env
  - The script template uses {{double braces}} for Python f-string literals
    that Blender itself will evaluate; {single} for host-side substitutions
  - On Blender-not-found the function raises FileNotFoundError with a
    clear message listing how to set BLENDER_PATH in .env
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Any

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Blender Python script template
# ---------------------------------------------------------------------------
# Rules for reading this template:
#   {single_brace}  → substituted by Python str.format() on the host side
#   {{double_brace}} → becomes {single_brace} after .format(), i.e. Blender-side Python

_BLENDER_SCRIPT = r'''
import bpy
import bmesh
import math
import json
import random

# ── clear scene ──────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for col in list(bpy.data.collections):
    bpy.data.collections.remove(col)

# ── load DNA ─────────────────────────────────────────────────────────────────
dna = {dna_json}
floors = {floors}

# ── derived geometry parameters ───────────────────────────────────────────────
bua = dna.get('built_up_area', 100)
width  = (bua ** 0.5) * 1.25
depth  = (bua ** 0.5) * 0.85
fh     = dna.get('floor_height', 3.0)      # floor-to-floor height
wwr    = dna.get('window_wall_ratio', 0.40)
palette    = dna.get('facade_material_palette', 'cool_modern')
roof_form  = dna.get('roof_form', 'flat_terrace')
facade_pat = dna.get('facade_pattern', 'horizontal_louvers')

# ── material palette colours ──────────────────────────────────────────────────
PALETTE_COLORS = {{
    'warm_earthy':       (0.80, 0.65, 0.50, 1.0),
    'cool_modern':       (0.85, 0.87, 0.90, 1.0),
    'natural_organic':   (0.60, 0.55, 0.45, 1.0),
    'luxury_premium':    (0.95, 0.92, 0.88, 1.0),
    'sustainable_green': (0.50, 0.65, 0.45, 1.0),
}}
base_color = PALETTE_COLORS.get(palette, (0.80, 0.80, 0.80, 1.0))

def make_mat(name, color, roughness=0.65, metallic=0.0, alpha=1.0, ior=1.45):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value  = roughness
    bsdf.inputs['Metallic'].default_value   = metallic
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value  = alpha
        bsdf.inputs['IOR'].default_value    = ior
        mat.blend_method = 'BLEND'
    return mat

facade_mat = make_mat('FacadeMat', base_color, roughness=0.70)
glass_mat  = make_mat('GlassMat',  (0.70, 0.85, 1.00, 0.15), roughness=0.02, ior=1.45, alpha=0.15)
fin_mat    = make_mat('FinMat',    (0.90, 0.90, 0.95, 1.0),  roughness=0.20, metallic=0.85)
roof_mat   = make_mat('RoofMat',   (0.25, 0.25, 0.28, 1.0),  roughness=0.80)

# ── floor plates ─────────────────────────────────────────────────────────────
for floor in range(floors):
    z_center = floor * fh + fh * 0.5
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z_center))
    obj = bpy.context.active_object
    obj.name = f'Floor_{{floor}}'
    obj.scale = (width, depth, fh * 0.97)
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(facade_mat)

# ── roof ─────────────────────────────────────────────────────────────────────
roof_z = floors * fh

if roof_form == 'flat_terrace':
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, roof_z + 0.15))
    r = bpy.context.active_object
    r.name = 'Roof'
    r.scale = (width + 0.3, depth + 0.3, 0.30)
    bpy.ops.object.transform_apply(scale=True)
    r.data.materials.append(roof_mat)

elif roof_form == 'shed_mono_pitch':
    mesh_data = bpy.data.meshes.new('RoofMesh')
    obj = bpy.data.objects.new('Roof', mesh_data)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    hw, hd = width / 2 + 0.4, depth / 2 + 0.4
    pitch = dna.get('mutation_factor', 0.15) * 3 + 1.5
    verts = [bm.verts.new(v) for v in [
        (-hw, -hd, roof_z), (hw, -hd, roof_z),
        (hw,  hd, roof_z + pitch), (-hw, hd, roof_z + pitch)
    ]]
    bm.faces.new(verts)
    bm.to_mesh(mesh_data); bm.free()
    obj.data.materials.append(roof_mat)

elif roof_form in ('butterfly_inverted', 'butterfly_clerestory'):
    mesh_data = bpy.data.meshes.new('ButterflyRoof')
    obj = bpy.data.objects.new('Roof', mesh_data)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    hw, hd = width / 2 + 0.4, depth / 2 + 0.4
    dip = 0.80
    verts = [bm.verts.new(v) for v in [
        (-hw, -hd, roof_z + 1.5), (hw, -hd, roof_z + 1.5),
        (0,   0,   roof_z + dip),
        (-hw,  hd, roof_z + 1.5), (hw,  hd, roof_z + 1.5),
    ]]
    bm.faces.new([verts[0], verts[1], verts[2]])
    bm.faces.new([verts[2], verts[1], verts[4], verts[3]])
    bm.to_mesh(mesh_data); bm.free()
    obj.data.materials.append(roof_mat)

elif roof_form == 'folded_plate':
    mesh_data = bpy.data.meshes.new('FoldedRoof')
    obj = bpy.data.objects.new('Roof', mesh_data)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    hw, hd = width / 2 + 0.4, depth / 2 + 0.4
    fold_h = 1.2
    verts = [bm.verts.new(v) for v in [
        (-hw, -hd, roof_z), (0, -hd, roof_z + fold_h),
        (hw,  -hd, roof_z), (hw,  hd, roof_z),
        (0,   hd,  roof_z + fold_h), (-hw, hd, roof_z),
    ]]
    bm.faces.new([verts[0], verts[1], verts[4], verts[5]])
    bm.faces.new([verts[1], verts[2], verts[3], verts[4]])
    bm.to_mesh(mesh_data); bm.free()
    obj.data.materials.append(roof_mat)

else:
    # Default: flat slab
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, roof_z + 0.15))
    r = bpy.context.active_object
    r.name = 'Roof'
    r.scale = (width + 0.3, depth + 0.3, 0.25)
    bpy.ops.object.transform_apply(scale=True)
    r.data.materials.append(roof_mat)

# ── facade treatment ──────────────────────────────────────────────────────────
for floor in range(floors):
    fz     = floor * fh
    fz_mid = fz + fh * 0.5
    win_h  = fh * wwr * 0.85
    win_w  = width * 0.72
    fz_win = fz + fh * 0.28

    if facade_pat == 'vertical_fins':
        fin_count = max(3, int(width / 1.4))
        spacing   = width / fin_count
        for i in range(fin_count):
            x = -width / 2 + (i + 0.5) * spacing
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, depth / 2 + 0.06, fz_mid))
            fin = bpy.context.active_object
            fin.name = f'Fin_{{floor}}_{{i}}'
            fin.scale = (0.07, 0.10, fh * 0.92)
            bpy.ops.object.transform_apply(scale=True)
            fin.data.materials.append(fin_mat)

    elif facade_pat == 'horizontal_louvers':
        louver_count = max(2, int(fh / 0.5))
        for j in range(louver_count):
            lz = fz + 0.3 + j * (fh / louver_count)
            bpy.ops.mesh.primitive_cube_add(size=1, location=(0, depth / 2 + 0.06, lz))
            lou = bpy.context.active_object
            lou.name = f'Louver_{{floor}}_{{j}}'
            lou.scale = (width * 0.85, 0.08, 0.05)
            bpy.ops.object.transform_apply(scale=True)
            lou.data.materials.append(fin_mat)

    elif facade_pat in ('glass_box', 'perforated_metal', 'jaali_screen', 'parametric_panels'):
        # Full-width glazing band
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, depth / 2 + 0.015, fz_win + win_h / 2))
        win = bpy.context.active_object
        win.name = f'Window_{{floor}}'
        win.scale = (win_w, 0.025, win_h)
        bpy.ops.object.transform_apply(scale=True)
        win.data.materials.append(glass_mat)

    else:
        # Standard punched windows
        win_count = max(2, int(width / 3.5))
        panel_w   = (width * 0.65) / win_count
        for k in range(win_count):
            x = -width * 0.325 + (k + 0.5) * (width * 0.65 / win_count)
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, depth / 2 + 0.015, fz_win + win_h / 2))
            win = bpy.context.active_object
            win.name = f'Win_{{floor}}_{{k}}'
            win.scale = (panel_w * 0.75, 0.025, win_h)
            bpy.ops.object.transform_apply(scale=True)
            win.data.materials.append(glass_mat)

# ── courtyard void (if applicable) ───────────────────────────────────────────
if dna.get('courtyard_presence'):
    ct_w, ct_d = width * 0.30, depth * 0.30
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, floors * fh / 2))
    void = bpy.context.active_object
    void.name = 'CourtyardVoid'
    void.scale = (ct_w, ct_d, floors * fh + 0.5)
    bpy.ops.object.transform_apply(scale=True)
    bool_mod = [o for o in bpy.data.objects if 'Floor_0' in o.name]
    # Visual marker only — boolean ops need EEVEE/Cycles; mark as placeholder
    void_mat = make_mat('VoidMat', (0.85, 0.95, 1.0, 1.0), roughness=0.9)
    void.data.materials.append(void_mat)

# ── ground plane ─────────────────────────────────────────────────────────────
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, -0.02))
gnd = bpy.context.active_object
gnd.name = 'Ground'
gnd.scale = (width * 4, depth * 4, 1)
bpy.ops.object.transform_apply(scale=True)
ground_mat = make_mat('GroundMat', (0.20, 0.35, 0.15, 1.0), roughness=0.95)
gnd.data.materials.append(ground_mat)

# ── driveway ─────────────────────────────────────────────────────────────────
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -depth * 2.0, -0.01))
drv = bpy.context.active_object
drv.name = 'Driveway'
drv.scale = (width * 0.4, depth * 1.5, 0.03)
bpy.ops.object.transform_apply(scale=True)
drv.data.materials.append(make_mat('DriveMat', (0.35, 0.35, 0.38, 1.0), roughness=0.85))

# ── trees ────────────────────────────────────────────────────────────────────
random.seed(abs(hash(str(dna.get('seed', 'archai')))) % (2**32))
tree_mat  = make_mat('TreeMat',  (0.10, 0.45, 0.12, 1.0), roughness=0.90)
trunk_mat = make_mat('TrunkMat', (0.35, 0.22, 0.10, 1.0), roughness=0.95)

for i in range(6):
    side  = 1 if i % 2 == 0 else -1
    tx    = random.uniform(width * 0.8, width * 1.6) * side
    ty    = random.uniform(-depth * 1.4, depth * 1.4)
    th    = random.uniform(3.0, 5.5)
    tr    = random.uniform(0.9, 1.6)
    # trunk
    bpy.ops.mesh.primitive_cylinder_add(radius=0.12, depth=th * 0.55, location=(tx, ty, th * 0.27))
    trunk = bpy.context.active_object
    trunk.name = f'Trunk_{{i}}'
    trunk.data.materials.append(trunk_mat)
    # canopy
    bpy.ops.mesh.primitive_cone_add(radius1=tr, depth=th * 0.75, location=(tx, ty, th * 0.60 + th * 0.375))
    tree = bpy.context.active_object
    tree.name = f'Tree_{{i}}'
    tree.data.materials.append(tree_mat)

# ── boundary wall ────────────────────────────────────────────────────────────
wall_mat = make_mat('WallMat', (0.70, 0.60, 0.50, 1.0), roughness=0.80)
wall_h   = 1.8
boundary = width * 1.8
for seg_x, seg_y, seg_sx, seg_sy in [
    (0,            -depth * 1.7, boundary, 0.20),   # front
    (0,             depth * 1.7, boundary, 0.20),   # rear
    (-width * 1.7,  0,           0.20,     boundary * depth / width),  # left
    ( width * 1.7,  0,           0.20,     boundary * depth / width),  # right
]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(seg_x, seg_y, wall_h / 2))
    w = bpy.context.active_object
    w.scale = (seg_sx, seg_sy, wall_h)
    bpy.ops.object.transform_apply(scale=True)
    w.data.materials.append(wall_mat)

# ── lighting ─────────────────────────────────────────────────────────────────
# Solar orientation from DNA (0° = N, 90° = E, 180° = S, 270° = W)
sun_angle_deg = dna.get('solar_orientation', 180.0)
sun_rad = math.radians(sun_angle_deg)
sun_x   = math.sin(sun_rad) * 15
sun_y   = -math.cos(sun_rad) * 15

bpy.ops.object.light_add(type='SUN', location=(sun_x, sun_y, 18))
sun = bpy.context.active_object
sun.name = 'SunLight'
sun.data.energy = 4.0
sun.data.angle  = math.radians(8)
sun.rotation_euler = (math.radians(55), 0, math.radians(sun_angle_deg))

bpy.ops.object.light_add(type='AREA', location=(-8, -10, 14))
fill = bpy.context.active_object
fill.name = 'FillLight'
fill.data.energy = 60
fill.data.size    = 10

bpy.ops.object.light_add(type='AREA', location=(0, 0, floors * fh + 8))
sky = bpy.context.active_object
sky.name = 'SkyLight'
sky.data.energy = 30
sky.data.size   = 20

# ── camera ───────────────────────────────────────────────────────────────────
cam_dist = max(width, depth) * 2.4
cam_h    = floors * fh * 0.85 + 5
bpy.ops.object.camera_add(location=(cam_dist, -cam_dist * 1.1, cam_h))
cam = bpy.context.active_object
cam.name = 'Camera_Main'
cam.rotation_euler = (math.radians(62), 0, math.radians(45))
cam.data.lens = 35
bpy.context.scene.camera = cam

# ── render settings ───────────────────────────────────────────────────────────
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.context.scene.eevee, 'use_raytracing') else 'BLENDER_EEVEE'
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080

# ── export GLB ───────────────────────────────────────────────────────────────
bpy.ops.export_scene.gltf(
    filepath='{output_path}',
    export_format='GLB',
    export_materials='EXPORT',
    export_cameras=True,
    export_lights=True,
    export_apply=True,
    export_yup=True,
)
print('ArchAI 3D: Export complete → {output_path}')
'''


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def generate_3d_model(
    design_dna: dict[str, Any],
    floors: int,
    output_dir: str,
) -> str:
    """
    Generate a 3D .glb model from a Design DNA dict using Blender headlessly.

    Args:
        design_dna : Plain dict representation of DesignDNA.
        floors     : Number of floors (passed separately for template clarity).
        output_dir : Directory where the .glb will be written.

    Returns:
        Absolute path to the generated .glb file.

    Raises:
        FileNotFoundError : Blender executable not found at BLENDER_PATH.
        RuntimeError      : Blender process returned non-zero or timed out.
    """
    dna_id = design_dna.get("dna_id", "unknown")
    output_path = os.path.join(output_dir, f"model_{dna_id}.glb")

    script = _build_blender_script(design_dna, floors, output_path)
    glb_path = await _run_blender(script, output_path)
    return glb_path


async def generate_all_variants(
    variants: list[dict[str, Any]],
    floors: int,
) -> list[dict[str, Any]]:
    """
    Generate .glb models for all design variants concurrently.

    Each variant dict is mutated in-place to add:
      - model_path  : str path to .glb  (or None on failure)
      - model_error : str error message  (only on failure)

    Args:
        variants : List of variant dicts from evolve_designs().
        floors   : Number of floors (same for all variants).

    Returns:
        The same list with model_path / model_error populated.
    """
    output_dir = tempfile.mkdtemp(prefix="archai_models_")
    logger.info("Generating %d 3D models in %s", len(variants), output_dir)

    tasks = [
        generate_3d_model(
            _extract_dna(v),
            floors,
            output_dir,
        )
        for v in variants
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    for variant, result in zip(variants, results):
        if isinstance(result, Exception):
            variant["model_path"] = None
            variant["model_error"] = str(result)
            logger.warning("3D generation failed for variant: %s", result)
        else:
            variant["model_path"] = result
            variant["model_error"] = None

    return variants


def get_model_metadata(glb_path: str) -> dict[str, Any]:
    """
    Return file metadata for a generated .glb.
    Returns an error dict if the file doesn't exist.
    """
    p = Path(glb_path)
    if not p.exists():
        return {"exists": False, "path": glb_path}
    stat = p.stat()
    return {
        "exists": True,
        "path": str(p.resolve()),
        "size_bytes": stat.st_size,
        "size_mb": round(stat.st_size / 1_048_576, 2),
        "filename": p.name,
    }


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _extract_dna(variant: dict[str, Any]) -> dict[str, Any]:
    """Pull the dna dict from a variant, handling both key names."""
    dna = variant.get("dna_dict") or variant.get("dna", {})
    return dna if isinstance(dna, dict) else {}


def _build_blender_script(
    design_dna: dict[str, Any],
    floors: int,
    output_path: str,
) -> str:
    """
    Render the Blender script template with the supplied DNA and paths.

    The output path uses forward slashes so Blender can parse it on
    all platforms (including Windows).
    """
    output_posix = output_path.replace("\\", "/")
    dna_json = json.dumps(design_dna, default=str, ensure_ascii=False)

    return _BLENDER_SCRIPT.format(
        dna_json=dna_json,
        floors=int(floors),
        output_path=output_posix,
    )


async def _run_blender(script: str, expected_output: str) -> str:
    """
    Write script to a temp file, invoke Blender headlessly, wait for .glb.

    Returns the path to the generated .glb file.
    Raises RuntimeError on failure.
    """
    blender_exe = settings.BLENDER_PATH or "blender"

    # Verify blender exists before spawning
    if not _blender_exists(blender_exe):
        raise FileNotFoundError(
            f"Blender not found at '{blender_exe}'. "
            "Set BLENDER_PATH in your .env to the full path of the Blender executable "
            "(e.g. C:/Program Files/Blender Foundation/Blender 4.2/blender.exe)."
        )

    # Write script to a named temp file
    with tempfile.NamedTemporaryFile(
        suffix=".py", mode="w", encoding="utf-8", delete=False
    ) as tmp:
        tmp.write(script)
        script_path = tmp.name

    logger.info("Running Blender: %s --background --python %s", blender_exe, script_path)

    try:
        proc = await asyncio.create_subprocess_exec(
            blender_exe,
            "--background",
            "--python", script_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=120.0
            )
        except asyncio.TimeoutError:
            proc.kill()
            raise RuntimeError(
                f"Blender timed out after 120s generating {expected_output}"
            )

        stdout_txt = stdout.decode("utf-8", errors="replace")
        stderr_txt = stderr.decode("utf-8", errors="replace")

        if proc.returncode != 0:
            # Surface the last 20 lines of stderr for diagnosis
            tail = "\n".join(stderr_txt.splitlines()[-20:])
            raise RuntimeError(
                f"Blender exited with code {proc.returncode}.\n"
                f"Last stderr:\n{tail}"
            )

        # Confirm output file was actually created
        if not os.path.exists(expected_output):
            raise RuntimeError(
                f"Blender exited 0 but .glb not found at {expected_output}.\n"
                f"stdout tail: {stdout_txt[-500:]}"
            )

        logger.info("3D model generated: %s", expected_output)
        return expected_output

    finally:
        # Always clean up the temp script
        try:
            os.unlink(script_path)
        except OSError:
            pass


def _blender_exists(path: str) -> bool:
    """Return True if the blender executable is findable."""
    if os.path.isfile(path):
        return True
    # Check PATH
    import shutil
    return shutil.which(path) is not None
