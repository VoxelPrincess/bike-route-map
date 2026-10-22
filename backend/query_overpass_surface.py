"""Overpass surface lookup helpers.

Surface percentage is currently calculated only around the first route point.
Whole-route analysis is intentionally out of scope for this module.
"""

from collections import OrderedDict
from typing import Dict, Tuple
from threading import Lock
import copy
import logging
import time

import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_TIMEOUT_SECONDS = 6.0
OVERPASS_USER_AGENT = "bike-route-map/1.0 (+https://github.com/VoxelPrincess/bike-route-map)"

CACHE_TTL_SECONDS = 120
CACHE_MAX_ENTRIES = 128

_CACHE: "OrderedDict[Tuple[float, float, int], Tuple[float, Dict[str, float]]]" = OrderedDict()
_CACHE_LOCK = Lock()

logger = logging.getLogger(__name__)


class OverpassError(Exception):
    """Base class for expected Overpass-related failures."""

    def __init__(self, message: str, *, status_code: int, code: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code


class OverpassTimeoutError(OverpassError):
    def __init__(self):
        super().__init__(
            "Overpass request timed out",
            status_code=504,
            code="overpass_timeout",
        )


class OverpassConnectionError(OverpassError):
    def __init__(self):
        super().__init__(
            "Unable to connect to Overpass",
            status_code=503,
            code="overpass_unavailable",
        )


class OverpassBadResponseError(OverpassError):
    def __init__(self, message: str, *, code: str = "overpass_bad_response"):
        super().__init__(message, status_code=502, code=code)


def _make_cache_key(lat: float, lon: float, radius: int) -> Tuple[float, float, int]:
    return (round(lat, 6), round(lon, 6), int(radius))


def _cache_get(key: Tuple[float, float, int]):
    with _CACHE_LOCK:
        item = _CACHE.get(key)
        if item is None:
            return None
        expires_at, value = item
        if time.monotonic() >= expires_at:
            _CACHE.pop(key, None)
            return None
        _CACHE.move_to_end(key)
        return copy.deepcopy(value)


def _cache_set(key: Tuple[float, float, int], value: Dict[str, float]):
    with _CACHE_LOCK:
        _CACHE[key] = (time.monotonic() + CACHE_TTL_SECONDS, copy.deepcopy(value))
        _CACHE.move_to_end(key)
        while len(_CACHE) > CACHE_MAX_ENTRIES:
            _CACHE.popitem(last=False)


def _post_overpass(query: str, headers=None):
    try:
        return requests.post(
            OVERPASS_URL,
            data={"data": query},
            headers=headers,
            timeout=OVERPASS_TIMEOUT_SECONDS,
        )
    except requests.Timeout as exc:
        raise OverpassTimeoutError() from exc
    except requests.ConnectionError as exc:
        raise OverpassConnectionError() from exc
    except requests.RequestException as exc:
        raise OverpassConnectionError() from exc


def _parse_surface_percentages(data: dict) -> Dict[str, float]:
    elements = data.get("elements")
    if not isinstance(elements, list):
        raise OverpassBadResponseError("Overpass returned invalid elements", code="overpass_invalid_payload")
    if len(elements) == 0:
        raise OverpassBadResponseError("Overpass returned empty data", code="overpass_empty_data")

    surface_counts: Dict[str, int] = {}
    for element in elements:
        if not isinstance(element, dict) or not isinstance(element.get("tags", {}), dict):
            raise OverpassBadResponseError("Overpass returned invalid tags", code="overpass_invalid_payload")
        tags = element.get("tags", {})
        surface = tags.get("surface")
        if surface is not None and not isinstance(surface, str):
            raise OverpassBadResponseError("Overpass returned invalid surface", code="overpass_invalid_payload")
        if surface:
            surface_counts[surface] = surface_counts.get(surface, 0) + 1

    total = sum(surface_counts.values())
    if total <= 0:
        raise OverpassBadResponseError(
            "Overpass returned no surface-tagged ways",
            code="overpass_empty_surface",
        )

    return {k: round((v / total) * 100, 1) for k, v in surface_counts.items()}


def query_overpass_surface(lat: float, lon: float, radius: int = 50):
    key = _make_cache_key(lat, lon, radius)
    cached = _cache_get(key)
    if cached is not None:
        return cached

    query = f"""
    [out:json];
    way(around:{radius},{lat},{lon})[highway][surface];
    out body;
    """

    response = _post_overpass(query)

    # Diagnostic check for the known 406 hypothesis: retry once with explicit User-Agent.
    if response.status_code == 406:
        logger.warning("Overpass returned 406; retrying once with explicit User-Agent header")
        ua_response = _post_overpass(query, headers={"User-Agent": OVERPASS_USER_AGENT})
        if ua_response.ok:
            logger.info("Overpass User-Agent retry returned HTTP %s", ua_response.status_code)
            response = ua_response
        else:
            raise OverpassBadResponseError(
                f"Overpass rejected request: HTTP 406 (UA retry status: {ua_response.status_code})",
                code="overpass_rejected",
            )

    if not response.ok:
        raise OverpassBadResponseError(
            f"Overpass returned HTTP {response.status_code}",
            code="overpass_rejected",
        )

    try:
        data = response.json()
    except ValueError as exc:
        raise OverpassBadResponseError("Overpass returned non-JSON response", code="overpass_invalid_json") from exc

    if not isinstance(data, dict):
        raise OverpassBadResponseError("Overpass returned invalid JSON payload", code="overpass_invalid_payload")

    result = _parse_surface_percentages(data)
    _cache_set(key, result)
    return result
