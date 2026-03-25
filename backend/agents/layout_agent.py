"""
Layout Planning Agent — ArchAI
Uses Claude AI to generate room layouts as JSON, then converts to SVG.
"""
from __future__ import annotations
import json, logging, re
from typing import Any
from anthropic import AsyncAnthropic
from config import settings

logger = logging.getLogger(__name__)

ROOM_PROGRAMS: dict[str, list[str]] = {
    "1bhk": ["living","kitchen","master_bedroom","bathroom","balcony"],
    "2bhk": ["living","dining","kitchen","master_bedroom","bedroom_2","bathroom_1","bathroom_2","balcony"],
    "3bhk": ["living","dining","kitchen","master_bedroom","bedroom_2","bedroom_3",
             "bathroom_1","bathroom_2","bathroom_3","utility","balcony_1","balcony_2"],
    "4bhk": ["living","dining","kitchen","master_bedroom","bedroom_2","bedroom_3","bedroom_4",
             "bathroom_1","bathroom_2","bathroom_3","study","utility","balcony_1","balcony_2"],
}

_ROOM_COLORS: dict[str, str] = {
    "living":"#E3F0FF","dining":"#FFF7E3","kitchen":"#FFE3E3",
    "bedroom":"#E3FFE8","bathroom":"#F0E3FF","balcony":"#D4F5D4",
    "utility":"#F5F5F5","circulation":"#FAFAFA","study":"#FFF3CD","default":"#EFEFEF",
}


async def generate_layout(
    plot_area_sqm: float, floors: int, budget_inr: int,
    design_dna: dict[str, Any], geo_data: dict[str, Any],
) -> dict[str, Any]:
    built_up_per_floor: float = design_dna.get("built_up_area", plot_area_sqm * 0.55)
    unit_type = _determine_unit_type(built_up_per_floor)
    rooms = ROOM_PROGRAMS[unit_type]

    layout_data = await _claude_layout(plot_area_sqm, built_up_per_floor, floors,
                                       unit_type, rooms, design_dna, geo_data)
    fp = layout_data.get("floor_plan", {})
    unique_floors = sorted({r.get("floor", 0) for r in fp.get("rooms", [])})
    svgs = {fn: generate_floor_plan_svg(fp, fn) for fn in unique_floors}

    layout_data["svgs"] = svgs
    layout_data["floor_plan_svg"] = svgs.get(0, "")
    layout_data["space_metrics"] = _space_metrics(fp, built_up_per_floor, floors)
    return layout_data


async def _claude_layout(plot_area_sqm, built_up_per_floor, floors,
                         unit_type, rooms, design_dna, geo_data) -> dict:
    w = round((built_up_per_floor ** 0.5) * 1.2, 1)
    d = round(built_up_per_floor / w, 1)
    prompt = f"""You are an expert residential architect in India.
Generate an optimised floor plan as JSON only (no markdown fences).

Plot: {plot_area_sqm:.0f}sqm | Built-up/floor: {built_up_per_floor:.0f}sqm (~{w}x{d}m) | Floors: {floors}
Unit: {unit_type.upper()} | Form: {design_dna.get("building_form","rectangular")}
Solar orientation: {design_dna.get("solar_orientation",180):.0f}° | Open-plan: {design_dna.get("open_plan_ratio",0.5):.2f}
Courtyard: {design_dna.get("courtyard_presence",False)} | Ventilation: {design_dna.get("natural_ventilation_strategy","cross_ventilation")}
Rooms: {rooms}

Return JSON structure:
{{
  "unit_type": "{unit_type}",
  "floor_plan": {{
    "width_m": number,
    "depth_m": number,
    "rooms": [{{"name":"...","type":"living|dining|kitchen|bedroom|bathroom|balcony|utility|circulation|study","x":num,"y":num,"width":num,"depth":num,"floor":0,"area_sqm":num,"features":[]}}]
  }},
  "circulation": {{"staircase_x":num,"staircase_y":num,"staircase_width":1.2,"main_entrance_x":num,"main_entrance_side":"front"}},
  "highlights": ["...","...","..."],
  "vastu_notes": ["..."]
}}"""
    try:
        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        resp = await client.messages.create(
            model="claude-3-5-sonnet-20241022", max_tokens=2500,
            messages=[{"role":"user","content":prompt}])
        raw = re.sub(r"^```[a-z]*\n?","", resp.content[0].text.strip(), flags=re.MULTILINE)
        raw = re.sub(r"\n?```$","", raw, flags=re.MULTILINE)
        return json.loads(raw)
    except Exception as exc:
        logger.warning("Claude layout failed (%s) — using heuristic", exc)
        return _heuristic_layout(unit_type, rooms, built_up_per_floor, floors)


def generate_floor_plan_svg(floor_plan: dict, floor_number: int = 0) -> str:
    SCALE, PAD = 32, 50
    wm = floor_plan.get("width_m", 12.0)
    dm = floor_plan.get("depth_m", 10.0)
    cw = int(wm * SCALE + PAD * 2)
    ch = int(dm * SCALE + PAD * 2 + 30)
    rooms = [r for r in floor_plan.get("rooms", []) if r.get("floor", 0) == floor_number]

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{cw}" height="{ch}" viewBox="0 0 {cw} {ch}" font-family="Inter,sans-serif">',
        f'<rect width="{cw}" height="{ch}" fill="#F8F9FA"/>',
        f'<text x="{cw//2}" y="20" text-anchor="middle" font-size="13" font-weight="600" fill="#1A1A2E">{"Ground Floor" if floor_number==0 else f"Floor {floor_number}"}</text>',
    ]
    bx, by_ = PAD, PAD + 24
    parts.append(f'<rect x="{bx}" y="{by_}" width="{int(wm*SCALE)}" height="{int(dm*SCALE)}" fill="white" stroke="#2D3561" stroke-width="2.5" rx="2"/>')

    for room in rooms:
        rx = bx + int(room.get("x", 0) * SCALE)
        ry = by_ + int(room.get("y", 0) * SCALE)
        rw = max(int(room.get("width", 3) * SCALE), 1)
        rd = max(int(room.get("depth", 3) * SCALE), 1)
        rtype = room.get("type", "default")
        ckey = next((k for k in _ROOM_COLORS if k in rtype.lower()), "default")
        fill = _ROOM_COLORS[ckey]
        label = room.get("name","").replace("_"," ").title()
        cx, cy2 = rx + rw // 2, ry + rd // 2
        fsz = max(7, min(11, rw // 9))
        parts += [
            f'<rect x="{rx}" y="{ry}" width="{rw}" height="{rd}" fill="{fill}" stroke="#AAB4C8" stroke-width="1" rx="1"/>',
            f'<text x="{cx}" y="{cy2-4}" text-anchor="middle" dominant-baseline="central" font-size="{fsz}" fill="#2D3561">{label}</text>',
            f'<text x="{cx}" y="{cy2+fsz+2}" text-anchor="middle" font-size="7" fill="#6B7280">{room.get("width",0):.1f}×{room.get("depth",0):.1f}m</text>',
        ]

    ax, ay = cw - 34, by_ + 14
    parts.append(
        f'<g transform="translate({ax},{ay})">'
        f'<circle cx="0" cy="0" r="12" fill="white" stroke="#2D3561" stroke-width="1"/>'
        f'<text x="0" y="-16" text-anchor="middle" font-size="8" fill="#2D3561">N</text>'
        f'<polygon points="0,-10 4,5 0,2 -4,5" fill="#2D3561"/>'
        f'<polygon points="0,10 4,-5 0,-2 -4,-5" fill="#B0B8C9"/>'
        f'</g>'
    )
    parts.append("</svg>")
    return "\n".join(parts)


def _determine_unit_type(sqm: float) -> str:
    if sqm < 55: return "1bhk"
    if sqm < 95: return "2bhk"
    if sqm < 140: return "3bhk"
    return "4bhk"

def _space_metrics(fp: dict, built_up_per_floor: float, floors: int) -> dict:
    rooms = fp.get("rooms", [])
    total_room = sum(r.get("width",0)*r.get("depth",0) for r in rooms)
    total_floor = built_up_per_floor * floors
    return {
        "total_room_area_sqm": round(total_room, 1),
        "total_floor_area_sqm": round(total_floor, 1),
        "space_efficiency_pct": round(total_room / max(total_floor,1) * 100, 1),
        "bedroom_count": sum(1 for r in rooms if "bedroom" in r.get("type","")),
        "bathroom_count": sum(1 for r in rooms if "bathroom" in r.get("type","")),
    }

def _heuristic_layout(unit_type, rooms, built_up_per_floor, floors) -> dict:
    w = round((built_up_per_floor**0.5)*1.3, 1)
    d = round(built_up_per_floor/w, 1)
    avg_rw, avg_rd = w/2, d/max(len(rooms)//2,1)
    placed = []
    for i, name in enumerate(rooms):
        col, row = i%2, i//2
        placed.append({"name":name,"type":_rtype(name),"x":round(col*avg_rw,1),
                        "y":round(row*avg_rd,1),"width":round(avg_rw,1),"depth":round(avg_rd,1),
                        "floor":0,"area_sqm":round(avg_rw*avg_rd,1),"features":[]})
    return {"unit_type":unit_type,"floor_plan":{"width_m":w,"depth_m":d,"rooms":placed},
            "circulation":{"staircase_x":round(w*0.45,1),"staircase_y":round(d*0.45,1),
                           "staircase_width":1.2,"main_entrance_x":round(w/2,1),"main_entrance_side":"front"},
            "highlights":[f"{unit_type.upper()} optimised for natural light","Cross-ventilation enabled","Open-plan living-dining"],
            "vastu_notes":["Main entrance facing east preferred"]}

def _rtype(name: str) -> str:
    n = name.lower()
    if "bed" in n: return "bedroom"
    if "bath" in n: return "bathroom"
    if "kitchen" in n: return "kitchen"
    if "living" in n: return "living"
    if "dining" in n: return "dining"
    if "balcony" in n or "terrace" in n: return "balcony"
    if "study" in n: return "study"
    if "utility" in n or "store" in n: return "utility"
    return "circulation"