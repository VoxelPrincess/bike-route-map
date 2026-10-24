"""ORS routing, validation and surface normalization for /api/v1/route."""

from __future__ import annotations

import os
from typing import Any, Dict, Tuple
import math

import requests

ORS_BASE_URL = "https://api.openrouteservice.org/v2"
ORS_TIMEOUT_SECONDS = 8.0


class ORSError(Exception):
    """Base class for expected ORS-related failures."""

    def __init__(self, message: str, *, status_code: int, code: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code


class SurfaceDataError(Exception):
    """Raised when route is valid but surface extras are missing/invalid."""

    def __init__(self, message: str, *, code: str = "surface_invalid_data"):
        super().__init__(message)
        self.code = code


class ORSConfigError(ORSError):
    def __init__(self):
        super().__init__(
            "Server ORS API key is not configured",
            status_code=503,
            code="ors_not_configured",
        )


class ORSTimeoutError(ORSError):
    def __init__(self):
        super().__init__(
            "ORS request timed out",
            status_code=504,
            code="ors_timeout",
        )


class ORSConnectionError(ORSError):
    def __init__(self):
        super().__init__(
            "Unable to connect to ORS",
            status_code=503,
            code="ors_unavailable",
        )


class ORSBadResponseError(ORSError):
    def __init__(self, message: str, *, code: str = "ors_invalid_response", status_code: int = 502):
        super().__init__(message, status_code=status_code, code=code)


def _read_api_key() -> str:
    # Server-side only. Frontend key must not be used here.
    key = os.getenv("ORS_API_KEY", "").strip()
    if not key:
        raise ORSConfigError()
    return key


def _extract_ors_error_code(payload: Any):
    if not isinstance(payload, dict):
        return None
    err = payload.get("error")
    if isinstance(err, dict):
        code = err.get("code")
        if isinstance(code, int):
            return code
    return None


def fetch_ors_route(*, start: Tuple[float, float], end: Tuple[float, float], profile: str) -> Dict[str, Any]:
    api_key = _read_api_key()
    url = f"{ORS_BASE_URL}/directions/{profile}/geojson"
    body = {
        "coordinates": [[start[0], start[1]], [end[0], end[1]]],
        "extra_info": ["surface"],
    }

    try:
        response = requests.post(
            url,
            headers={"Authorization": api_key, "Content-Type": "application/json"},
            json=body,
            timeout=ORS_TIMEOUT_SECONDS,
        )
    except requests.Timeout as exc:
        raise ORSTimeoutError() from exc
    except requests.ConnectionError as exc:
        raise ORSConnectionError() from exc
    except requests.RequestException as exc:
        raise ORSConnectionError() from exc

    payload = None
    try:
        payload = response.json()
    except ValueError:
        payload = None

    if not response.ok:
        ors_code = _extract_ors_error_code(payload)
        if ors_code == 2009:
            raise ORSBadResponseError(
                "No route found between selected points",
                code="route_not_found",
                status_code=404,
            )
        if ors_code == 2010:
            raise ORSBadResponseError(
                "One or more waypoints are unreachable",
                code="waypoint_not_found",
                status_code=422,
            )

        if response.status_code in (401, 403):
            raise ORSBadResponseError(
                "ORS access denied",
                code="ors_auth_failed",
                status_code=502,
            )
        if response.status_code == 429:
            raise ORSBadResponseError(
                "ORS rate limit exceeded",
                code="ors_rate_limited",
                status_code=503,
            )
        if response.status_code in (408, 504):
            raise ORSBadResponseError(
                "ORS request timed out",
                code="ors_timeout",
                status_code=504,
            )
        if 500 <= response.status_code <= 599:
            raise ORSBadResponseError(
                f"ORS upstream service error: HTTP {response.status_code}",
                code="ors_unavailable",
                status_code=503,
            )

        raise ORSBadResponseError(
            f"ORS returned HTTP {response.status_code}",
            code="ors_rejected",
            status_code=502,
        )

    if not isinstance(payload, dict):
        raise ORSBadResponseError("ORS returned non-JSON response", code="ors_invalid_response", status_code=502)

    return payload


def extract_route_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    features = payload.get("features")
    if not isinstance(features, list) or len(features) == 0 or not isinstance(features[0], dict):
        raise ORSBadResponseError("ORS returned no route features", code="ors_invalid_response", status_code=502)

    feature = features[0]
    geometry = feature.get("geometry")
    if not isinstance(geometry, dict):
        raise ORSBadResponseError("ORS route geometry is missing", code="ors_invalid_response", status_code=502)
    if geometry.get("type") != "LineString" or not isinstance(geometry.get("coordinates"), list):
        raise ORSBadResponseError("ORS route geometry is invalid", code="ors_invalid_response", status_code=502)

    coordinates = geometry.get("coordinates")
    if len(coordinates) < 2:
        raise ORSBadResponseError("ORS route geometry has too few points", code="ors_invalid_response", status_code=502)
    for coord in coordinates:
        if not isinstance(coord, list) or len(coord) < 2:
            raise ORSBadResponseError("ORS route geometry coordinates are invalid", code="ors_invalid_response", status_code=502)
        lon = coord[0]
        lat = coord[1]
        if isinstance(lon, bool) or isinstance(lat, bool):
            raise ORSBadResponseError("ORS route geometry coordinates are invalid", code="ors_invalid_response", status_code=502)
        if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
            raise ORSBadResponseError("ORS route geometry coordinates are invalid", code="ors_invalid_response", status_code=502)
        if not math.isfinite(float(lon)) or not math.isfinite(float(lat)):
            raise ORSBadResponseError("ORS route geometry coordinates are invalid", code="ors_invalid_response", status_code=502)
        if float(lon) < -180.0 or float(lon) > 180.0:
            raise ORSBadResponseError("ORS route geometry coordinates are invalid", code="ors_invalid_response", status_code=502)
        if float(lat) < -90.0 or float(lat) > 90.0:
            raise ORSBadResponseError("ORS route geometry coordinates are invalid", code="ors_invalid_response", status_code=502)

    properties = feature.get("properties")
    summary = properties.get("summary") if isinstance(properties, dict) else None
    if not isinstance(summary, dict):
        raise ORSBadResponseError("ORS route summary is missing", code="ors_invalid_response", status_code=502)

    distance = summary.get("distance")
    duration = summary.get("duration")
    if isinstance(distance, bool) or isinstance(duration, bool):
        raise ORSBadResponseError("ORS route summary is invalid", code="ors_invalid_response", status_code=502)
    if not isinstance(distance, (int, float)) or not isinstance(duration, (int, float)):
        raise ORSBadResponseError("ORS route summary is invalid", code="ors_invalid_response", status_code=502)
    if not math.isfinite(float(distance)) or not math.isfinite(float(duration)):
        raise ORSBadResponseError("ORS route summary is invalid", code="ors_invalid_response", status_code=502)
    if float(distance) <= 0 or float(duration) < 0:
        raise ORSBadResponseError("ORS route summary is invalid", code="ors_invalid_response", status_code=502)

    return {
        "type": "Feature",
        "geometry": geometry,
        "properties": {
            "distance_m": float(distance),
            "duration_s": float(duration),
            "source": "ors",
        },
    }


# ORS Surface IDs, documentation v10.0.1 (checked 2026-10-23):
# https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/extra-info/surface
# Retain documented legacy IDs 5, 9 and 16 for responses from older graphs.
SURFACE_LABELS = {
    0: "unknown", 1: "paved", 2: "unpaved", 3: "asphalt", 4: "concrete",
    5: "cobblestone", 6: "metal", 7: "wood", 8: "compacted_gravel",
    9: "fine_gravel", 10: "gravel", 11: "dirt", 12: "ground", 13: "ice",
    14: "paving_stones", 15: "sand", 16: "woodchips", 17: "grass",
    18: "grass_paver",
}

# Project validation tolerances; not a claim about real-road accuracy.
SURFACE_COMPARISON_EPSILON = 1e-9


def _surface_number(value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise SurfaceDataError("Surface summary contains a nonnumeric value")
    try:
        number = float(value)
    except OverflowError as exc:
        raise SurfaceDataError("Surface summary contains an invalid number") from exc
    if not math.isfinite(number) or number < 0:
        raise SurfaceDataError("Surface summary contains an invalid number")
    return number


def _surface_code(value: Any) -> int:
    """Normalize an ORS category value, which the API schema defines as numeric."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise SurfaceDataError("Surface summary codes must be integers")
    if isinstance(value, float):
        if not math.isfinite(value) or not value.is_integer():
            raise SurfaceDataError("Surface summary codes must be integers")
        return int(value)
    return value


def extract_surface_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize extras against the route from the same GeoJSON response.

    The caller validates the route first, so surface failures can preserve it.
    Amount is already a percentage. No lengths or missing edges are invented.
    """
    route = extract_route_payload(payload)
    properties = payload["features"][0]["properties"]
    extras = properties.get("extras")
    if extras is None:
        raise SurfaceDataError("Surface extras are missing", code="surface_unavailable")
    if not isinstance(extras, dict):
        raise SurfaceDataError("Surface extras are invalid")
    surface = extras.get("surface")
    if surface is None:
        raise SurfaceDataError("Surface extras are missing", code="surface_unavailable")
    if not isinstance(surface, dict):
        raise SurfaceDataError("Surface extras are invalid")

    summary = surface.get("summary")
    values = surface.get("values")
    for rows in (summary, values):
        if rows is not None and not isinstance(rows, list):
            raise SurfaceDataError("Surface extras are invalid")
    if not summary or not values:
        raise SurfaceDataError("Surface extras are unavailable", code="surface_unavailable")

    distance = route["properties"]["distance_m"]
    point_count = len(route["geometry"]["coordinates"])
    normalized_summary = []
    summary_codes = set()
    for row in summary:
        if not isinstance(row, dict):
            raise SurfaceDataError("Surface summary rows are invalid")
        code = _surface_code(row.get("value"))
        if code in summary_codes:
            raise SurfaceDataError("Surface summary codes are duplicated")
        length = _surface_number(row.get("distance"))
        percent = _surface_number(row.get("amount"))
        if percent > 100:
            raise SurfaceDataError("Surface percentage is outside [0, 100]")
        if abs(percent - length / distance * 100) > 0.15 + SURFACE_COMPARISON_EPSILON:
            raise SurfaceDataError("Surface percentage does not match its distance")
        summary_codes.add(code)
        normalized_summary.append({
            "surface_code": code,
            "surface": SURFACE_LABELS.get(code, "unknown"),
            "distance_m": length,
            "percent": percent,
        })

    total_distance = math.fsum(row["distance_m"] for row in normalized_summary)
    total_percent = math.fsum(row["percent"] for row in normalized_summary)
    if abs(total_distance - distance) > max(1.0, 0.001 * distance) + SURFACE_COMPARISON_EPSILON:
        raise SurfaceDataError("Surface distances do not cover the route")
    if abs(total_percent - 100) > 0.01 * len(summary) + SURFACE_COMPARISON_EPSILON:
        raise SurfaceDataError("Surface percentages do not cover the route")

    segments = []
    segment_codes = set()
    previous_end = 0
    for segment in values:
        if not isinstance(segment, list) or len(segment) != 3:
            raise SurfaceDataError("Surface segment rows must be triples")
        start, end, code = segment
        if any(type(value) is not int for value in segment):
            raise SurfaceDataError("Surface segment values must be integers")
        if not (0 <= start < end < point_count) or start != previous_end:
            raise SurfaceDataError("Surface segments must cover consecutive route edges")
        segments.append({
            "surface_code": code,
            "surface": SURFACE_LABELS.get(code, "unknown"),
            "index_start": start,
            "index_end": end,
        })
        segment_codes.add(code)
        previous_end = end
    if previous_end != point_count - 1 or segment_codes != summary_codes:
        raise SurfaceDataError("Surface segments and summary do not cover the same route")

    return {
        "summary": normalized_summary,
        "segments": segments,
        "source": "ors.extra_info.surface",
    }
