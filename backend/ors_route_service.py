"""ORS routing client helpers for /api/v1/route.

Stage 1 scope:
- live ORS request through backend
- controlled failures with stable error codes
- route extraction
- surface extraction (partial response when unavailable/invalid)
"""

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


def extract_surface_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    features = payload.get("features")
    if not isinstance(features, list) or len(features) == 0 or not isinstance(features[0], dict):
        raise SurfaceDataError("Surface data is unavailable")

    feature = features[0]
    properties = feature.get("properties")
    extras = properties.get("extras") if isinstance(properties, dict) else None
    surface = extras.get("surface") if isinstance(extras, dict) else None
    if not isinstance(surface, dict):
        raise SurfaceDataError("Surface extras are missing", code="surface_unavailable")

    summary = surface.get("summary")
    values = surface.get("values")
    if not isinstance(summary, list) or not isinstance(values, list):
        raise SurfaceDataError("Surface extras are invalid")
    if len(summary) == 0 or len(values) == 0:
        raise SurfaceDataError("Surface extras are unavailable", code="surface_unavailable")

    for row in summary:
        if not isinstance(row, dict):
            raise SurfaceDataError("Surface summary rows are invalid")
        if "value" not in row or "distance" not in row or "amount" not in row:
            raise SurfaceDataError("Surface summary rows are incomplete")
        value = row.get("value")
        distance = row.get("distance")
        amount = row.get("amount")

        if isinstance(value, bool) or not isinstance(value, int):
            raise SurfaceDataError("Surface summary rows are invalid")
        if isinstance(distance, bool) or not isinstance(distance, (int, float)):
            raise SurfaceDataError("Surface summary rows are invalid")
        if isinstance(amount, bool) or not isinstance(amount, (int, float)):
            raise SurfaceDataError("Surface summary rows are invalid")

        if not math.isfinite(float(distance)) or not math.isfinite(float(amount)):
            raise SurfaceDataError("Surface summary rows are invalid")

        if float(distance) < 0 or float(amount) < 0:
            raise SurfaceDataError("Surface summary rows are invalid")

    for segment in values:
        if not isinstance(segment, list) or len(segment) < 3:
            raise SurfaceDataError("Surface segment rows are invalid")
        start_idx, end_idx, surface_code = segment[0], segment[1], segment[2]
        if isinstance(start_idx, bool) or not isinstance(start_idx, int):
            raise SurfaceDataError("Surface segment rows are invalid")
        if isinstance(end_idx, bool) or not isinstance(end_idx, int):
            raise SurfaceDataError("Surface segment rows are invalid")
        if isinstance(surface_code, bool) or not isinstance(surface_code, int):
            raise SurfaceDataError("Surface segment rows are invalid")
        if start_idx < 0 or end_idx < start_idx:
            raise SurfaceDataError("Surface segment rows are invalid")

    return {
        "summary": summary,
        "segments": values,
        "source": "ors.extra_info.surface",
    }
