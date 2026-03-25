"""
Geo Analysis Agent — ArchAI
Analyses a building site using only FREE, no-key-required APIs:
  - Nominatim (OpenStreetMap) : reverse geocoding & address context
  - OpenTopoData (SRTM90m)    : elevation
  - Overpass API              : nearby amenities, roads, buildings
  - Open-Meteo                : climate data, solar irradiance, wind
"""

from __future__ import annotations

import asyncio
import logging
import math
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# API endpoints (all free, no auth required)
# ---------------------------------------------------------------------------
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
NOMINATIM_URL = "https://nominatim.openstreetmap.org"
OPENTOPODATA_URL = "https://api.opentopodata.org/v1/srtm90m"
OPEN_METEO_URL = "https://api.open-meteo.com/v1"

# Browser-like UA to satisfy Nominatim's policy
_HEADERS = {"User-Agent": "ArchAI/2.0 (archai.design; contact@archai.design)"}

# Indian metros that qualify for higher FSI under local DCRs
_HIGH_FSI_CITIES = {
    "mumbai", "delhi", "bangalore", "bengaluru", "chennai",
    "hyderabad", "pune", "kolkata", "ahmedabad", "surat",
    "navi mumbai", "thane",
}


# ---------------------------------------------------------------------------
# Public entry-point
# ---------------------------------------------------------------------------

async def analyze_geo(
    latitude: float,
    longitude: float,
    plot_area: float,
) -> dict[str, Any]:
    """
    Analyse a plot's geographic context.

    Returns a rich dict consumed by the evolutionary algorithm, compliance
    agent, sustainability agent, and cost agent.
    """
    async with httpx.AsyncClient(timeout=30.0, headers=_HEADERS) as client:
        location_ctx, elevation, amenities, climate, roads = await asyncio.gather(
            _get_location_context(client, latitude, longitude),
            _get_elevation(client, latitude, longitude),
            _get_nearby_amenities(client, latitude, longitude),
            _get_climate_and_solar(client, latitude, longitude),
            _get_road_access(client, latitude, longitude),
            return_exceptions=True,
        )

    # Resolve exceptions to safe defaults
    if isinstance(location_ctx, Exception):
        logger.warning("Nominatim failed: %s", location_ctx)
        location_ctx = {}
    if isinstance(elevation, Exception):
        logger.warning("OpenTopoData failed: %s", elevation)
        elevation = 0.0
    if isinstance(amenities, Exception):
        logger.warning("Overpass amenities failed: %s", amenities)
        amenities = {}
    if isinstance(climate, Exception):
        logger.warning("Open-Meteo failed: %s", climate)
        climate = _default_climate()
    if isinstance(roads, Exception):
        logger.warning("Overpass roads failed: %s", roads)
        roads = {"roads": [], "count": 0, "best_road_type": "unknown"}

    # Derived fields
    optimal_orientation = 180.0 if latitude >= 0 else 0.0  # South in N hemisphere
    zoning = _estimate_zoning(amenities)
    fsi = _estimate_fsi(location_ctx, zoning)
    climate_zone = _classify_climate_zone(climate, latitude)
    wind_direction = _classify_wind_direction(climate.get("wind_direction_dominant_deg", 225))
    annual_rainfall = _estimate_annual_rainfall(climate)

    return {
        # Identity
        "latitude": latitude,
        "longitude": longitude,
        "plot_area": plot_area,
        # Geocoding
        "location_context": location_ctx,
        "address": location_ctx.get("address", {}),
        "display_name": location_ctx.get("display_name", ""),
        # Terrain
        "elevation_m": float(elevation) if elevation else 0.0,
        # Amenities / density
        "nearby_amenities": amenities,
        "amenity_count": amenities.get("total", {}).get("count", 0),
        # Climate
        "climate_zone": climate_zone,
        "solar_irradiance_kwh_m2_day": climate.get("solar_kwh_m2_day", 5.0),
        "annual_avg_temp_c": climate.get("avg_temp_c", 27.0),
        "annual_rainfall_mm": annual_rainfall,
        "prevailing_wind_direction": wind_direction,
        "avg_wind_speed_ms": climate.get("avg_wind_speed_ms", 3.0),
        # Roads
        "road_access": roads,
        # Derived design inputs
        "optimal_solar_orientation": optimal_orientation,
        "zoning_type": zoning,
        "fsi_allowed": fsi,
        # Flags useful to compliance agent
        "is_metro_city": _is_metro(location_ctx),
        "flood_risk": _estimate_flood_risk(elevation, climate),
    }


# ---------------------------------------------------------------------------
# Individual fetch functions
# ---------------------------------------------------------------------------

async def _get_location_context(
    client: httpx.AsyncClient, lat: float, lon: float
) -> dict:
    resp = await client.get(
        f"{NOMINATIM_URL}/reverse",
        params={"lat": lat, "lon": lon, "format": "json", "zoom": 16},
    )
    resp.raise_for_status()
    return resp.json()


async def _get_elevation(
    client: httpx.AsyncClient, lat: float, lon: float
) -> float:
    resp = await client.get(
        OPENTOPODATA_URL,
        params={"locations": f"{lat},{lon}"},
    )
    resp.raise_for_status()
    data = resp.json()
    results = data.get("results", [])
    return float(results[0]["elevation"]) if results else 0.0


async def _get_nearby_amenities(
    client: httpx.AsyncClient, lat: float, lon: float, radius: int = 600
) -> dict:
    """Count amenities, buildings, and road segments within `radius` metres."""
    query = f"""
[out:json][timeout:20];
(
  node["amenity"](around:{radius},{lat},{lon});
  node["shop"](around:{radius},{lat},{lon});
  node["leisure"](around:{radius},{lat},{lon});
  way["building"](around:{radius},{lat},{lon});
  way["highway"](around:{radius},{lat},{lon});
);
out count;
"""
    resp = await client.post(OVERPASS_URL, data={"data": query})
    resp.raise_for_status()
    data = resp.json()

    # Overpass count returns {"total":{"count":N},"nodes":{"count":N},...}
    return data


async def _get_climate_and_solar(
    client: httpx.AsyncClient, lat: float, lon: float
) -> dict:
    """
    Fetch 7-day forecast for solar radiation, temperature, and wind.
    Open-Meteo requires no API key.
    """
    resp = await client.get(
        f"{OPEN_METEO_URL}/forecast",
        params={
            "latitude": lat,
            "longitude": lon,
            "daily": [
                "shortwave_radiation_sum",
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "windspeed_10m_max",
                "winddirection_10m_dominant",
            ],
            "timezone": "auto",
            "forecast_days": 7,
        },
    )
    resp.raise_for_status()
    data = resp.json()
    daily = data.get("daily", {})

    def _safe_avg(key: str, default: float) -> float:
        vals = [v for v in daily.get(key, []) if v is not None]
        return round(sum(vals) / len(vals), 3) if vals else default

    solar_wh = _safe_avg("shortwave_radiation_sum", 5000.0)   # Wh/m²/day
    solar_kwh = round(solar_wh / 1000, 3)                     # kWh/m²/day

    temp_max = _safe_avg("temperature_2m_max", 32.0)
    temp_min = _safe_avg("temperature_2m_min", 22.0)
    precip = _safe_avg("precipitation_sum", 2.0)              # mm/day
    wind_speed = _safe_avg("windspeed_10m_max", 15.0)         # km/h → m/s below
    wind_dir = _safe_avg("winddirection_10m_dominant", 225.0) # degrees

    return {
        "solar_kwh_m2_day": solar_kwh,
        "avg_temp_c": round((temp_max + temp_min) / 2, 1),
        "temp_max_c": temp_max,
        "temp_min_c": temp_min,
        "avg_precip_mm_day": precip,
        "avg_wind_speed_ms": round(wind_speed / 3.6, 2),   # km/h → m/s
        "wind_direction_dominant_deg": wind_dir,
    }


async def _get_road_access(
    client: httpx.AsyncClient, lat: float, lon: float, radius: int = 120
) -> dict:
    """Identify road types giving access to the plot."""
    query = f"""
[out:json][timeout:15];
way["highway"](around:{radius},{lat},{lon});
out tags;
"""
    resp = await client.post(OVERPASS_URL, data={"data": query})
    resp.raise_for_status()
    data = resp.json()
    elements = data.get("elements", [])
    roads = [el.get("tags", {}) for el in elements if el.get("tags")]

    road_types = [r.get("highway", "unknown") for r in roads]

    # Rank road quality
    _priority = {
        "trunk": 5, "primary": 4, "secondary": 3,
        "tertiary": 2, "residential": 1, "service": 0,
    }
    best = max(road_types, key=lambda t: _priority.get(t, -1), default="unknown")

    return {
        "roads": roads[:5],
        "count": len(roads),
        "road_types": list(set(road_types)),
        "best_road_type": best,
    }


# ---------------------------------------------------------------------------
# Derivation helpers
# ---------------------------------------------------------------------------

def _default_climate() -> dict:
    return {
        "solar_kwh_m2_day": 5.0,
        "avg_temp_c": 27.0,
        "temp_max_c": 34.0,
        "temp_min_c": 20.0,
        "avg_precip_mm_day": 2.2,
        "avg_wind_speed_ms": 3.0,
        "wind_direction_dominant_deg": 225.0,
    }


def _classify_climate_zone(climate: dict, latitude: float) -> str:
    avg_temp = climate.get("avg_temp_c", 27.0)
    precip_day = climate.get("avg_precip_mm_day", 2.0)

    if abs(latitude) < 15:
        return "tropical" if precip_day > 1.5 else "hot_arid"
    if abs(latitude) < 30:
        if avg_temp > 30:
            return "hot_humid" if precip_day > 1.0 else "hot_dry"
        return "warm_temperate"
    if abs(latitude) < 50:
        return "temperate"
    return "cold"


def _classify_wind_direction(degrees: float) -> str:
    dirs = [
        "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
    ]
    idx = round(degrees / 22.5) % 16
    return dirs[idx]


def _estimate_annual_rainfall(climate: dict) -> int:
    """Extrapolate annual rainfall from daily average (rough estimate)."""
    daily_mm = climate.get("avg_precip_mm_day", 2.2)
    # Seasonal factor: monsoon regions have concentrated rainfall; apply 0.7x
    return int(daily_mm * 365 * 0.70)


def _estimate_zoning(amenities: dict) -> str:
    count = 0
    if isinstance(amenities, dict):
        count = amenities.get("total", {}).get("count", 0)
    if count > 100:
        return "commercial_mixed"
    if count > 40:
        return "residential_urban"
    if count > 10:
        return "residential_suburban"
    return "residential_rural"


def _estimate_fsi(location_ctx: dict, zoning: str) -> float:
    """Rough FSI estimates aligned with Indian DCRs."""
    address = location_ctx.get("address", {})
    city = (
        address.get("city", "")
        or address.get("county", "")
        or address.get("state_district", "")
    ).lower()

    if city in _HIGH_FSI_CITIES:
        if zoning == "commercial_mixed":
            return 3.0
        return 2.5
    if zoning in ("residential_urban", "commercial_mixed"):
        return 1.75
    return 1.5


def _is_metro(location_ctx: dict) -> bool:
    address = location_ctx.get("address", {})
    city = (address.get("city", "") or address.get("county", "")).lower()
    return city in _HIGH_FSI_CITIES


def _estimate_flood_risk(elevation_m: float, climate: dict) -> str:
    precip = climate.get("avg_precip_mm_day", 2.0)
    if elevation_m < 5 and precip > 4.0:
        return "high"
    if elevation_m < 15 and precip > 2.5:
        return "medium"
    return "low"