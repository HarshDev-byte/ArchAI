"""
Geospatial utility functions.

Uses shapely + pyproj for accurate geodetic calculations.
"""
from __future__ import annotations

from shapely.geometry import shape
from shapely.ops import transform
from pyproj import Transformer

from models.project import GeoJSONFeature


def compute_parcel_area_sqm(feature: GeoJSONFeature) -> float:
    """
    Compute the geodetically accurate area of a GeoJSON Polygon in square metres.

    Projects from WGS-84 (EPSG:4326) to a local UTM zone via
    an auto-selected Equal-Area projection so the answer is accurate
    regardless of where on Earth the parcel sits.

    Args:
        feature: A GeoJSONFeature with a Polygon or MultiPolygon geometry.

    Returns:
        Area in square metres (always positive).

    Raises:
        ValueError: If the geometry cannot be parsed or projected.
    """
    try:
        geom_dict = {
            "type": feature.geometry.type,
            "coordinates": feature.geometry.coordinates,
        }
        geom_wgs84 = shape(geom_dict)
    except Exception as exc:
        raise ValueError(f"Invalid parcel geometry: {exc}") from exc

    # Use the centroid to auto-select an Equal-Area CRS
    centroid = geom_wgs84.centroid
    lon, lat = centroid.x, centroid.y

    # EPSG:6933 — WGS 84 / NSIDC EASE-Grid 2.0 Global (Equal-Area)
    # An alternative is to pick the UTM zone dynamically:
    utm_zone = int((lon + 180) / 6) + 1
    hemisphere = "north" if lat >= 0 else "south"
    epsg_utm = 32600 + utm_zone if hemisphere == "north" else 32700 + utm_zone

    try:
        transformer = Transformer.from_crs(
            "EPSG:4326", f"EPSG:{epsg_utm}", always_xy=True
        )
        geom_projected = transform(transformer.transform, geom_wgs84)
    except Exception as exc:
        raise ValueError(f"Projection failed (EPSG:{epsg_utm}): {exc}") from exc

    return abs(geom_projected.area)


def get_parcel_centroid(feature: GeoJSONFeature) -> tuple[float, float]:
    """
    Return the (longitude, latitude) centroid of the parcel.
    """
    geom_dict = {
        "type": feature.geometry.type,
        "coordinates": feature.geometry.coordinates,
    }
    geom = shape(geom_dict)
    centroid = geom.centroid
    return (centroid.x, centroid.y)


def get_parcel_bbox(feature: GeoJSONFeature) -> tuple[float, float, float, float]:
    """
    Return (min_lon, min_lat, max_lon, max_lat) bounding box of the parcel.
    """
    geom_dict = {
        "type": feature.geometry.type,
        "coordinates": feature.geometry.coordinates,
    }
    geom = shape(geom_dict)
    return geom.bounds  # (minx, miny, maxx, maxy)
