from fastapi import FastAPI
from fastapi import Request
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Scope, Receive, Send
from pydantic import BaseModel, Field
from pydantic import ConfigDict
from pydantic import field_validator, model_validator
from typing import Annotated, List
from contextlib import asynccontextmanager
import logging
import math
import os

from query_overpass_surface import (
    OverpassError,
    query_overpass_surface,
)
from ors_route_service import (
    ORSConfigError,
    ORSError,
    SurfaceDataError,
    extract_route_payload,
    extract_surface_payload,
    fetch_ors_route,
    is_api_key_configured,
)
from route_guard import RouteGuard

logger = logging.getLogger(__name__)
# uvicorn configures this logger at INFO, so the startup line is visible.
startup_logger = logging.getLogger("uvicorn.error")

route_guard = RouteGuard()


def _route_api_enabled() -> bool:
    return os.environ.get("ENABLE_ROUTE_API") == "1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    startup_logger.info(
        "Route API startup: route_api_enabled=%s ors_key_configured=%s",
        str(_route_api_enabled()).lower(),
        str(is_api_key_configured()).lower(),
    )
    yield


app = FastAPI(lifespan=lifespan)

class LegacySurfaceMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] == "http"
            and scope["method"] == "POST"
            and scope["path"] == "/analyze-surface"
            and os.environ.get("ENABLE_LEGACY_SURFACE") != "1"
        ):
            response = JSONResponse(
                status_code=404,
                content={"detail": {
                    "code": "legacy_endpoint_disabled",
                    "message": "This endpoint is disabled",
                }},
            )
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)


app.add_middleware(LegacySurfaceMiddleware)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],   # or ["POST", "OPTIONS"]
    allow_headers=["*"],   # to allow Content-Type
)

class LineString(BaseModel):
    type: str
    coordinates: List[Annotated[List[float], Field(min_length=2)]]


class RouteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: Annotated[List[float], Field(min_length=2, max_length=2)]
    end: Annotated[List[float], Field(min_length=2, max_length=2)]
    profile: str = "cycling-regular"

    @staticmethod
    def _validate_point(point: List[float], *, name: str) -> List[float]:
        if not isinstance(point, list) or len(point) != 2:
            raise ValueError(f"{name} must be [lon, lat]")

        lon_raw, lat_raw = point[0], point[1]
        if isinstance(lon_raw, bool) or isinstance(lat_raw, bool):
            raise ValueError(f"{name} must contain numeric coordinates")

        if not isinstance(lon_raw, (int, float)) or not isinstance(lat_raw, (int, float)):
            raise ValueError(f"{name} must contain numeric coordinates")

        lon = float(lon_raw)
        lat = float(lat_raw)

        if not math.isfinite(lon) or not math.isfinite(lat):
            raise ValueError(f"{name} must contain finite coordinates")

        if lon < -180.0 or lon > 180.0:
            raise ValueError(f"{name}.lon is out of range [-180, 180]")
        if lat < -90.0 or lat > 90.0:
            raise ValueError(f"{name}.lat is out of range [-90, 90]")

        return [lon, lat]

    @field_validator("start", mode="before")
    @classmethod
    def validate_start(cls, value):
        return cls._validate_point(value, name="start")

    @field_validator("end", mode="before")
    @classmethod
    def validate_end(cls, value):
        return cls._validate_point(value, name="end")

    @model_validator(mode="after")
    def validate_distinct_points(self):
        if self.start[0] == self.end[0] and self.start[1] == self.end[1]:
            raise ValueError("start and end must be different points")
        return self


def _route_envelope(status: str, route, surface, error):
    return {
        "status": status,
        "mode": "live",
        "route": route,
        "surface": surface,
        "error": error,
    }


def _route_rejection(
    status_code: int, code: str, message: str, retry_after=None, *, warn: bool = False
):
    if warn:
        logger.warning(
            "[route-guard] rejected code=%s status=%s retry_after=%s",
            code, status_code, retry_after,
        )
    return JSONResponse(
        status_code=status_code,
        content=_route_envelope(
            status="error",
            route=None,
            surface=None,
            error={"code": code, "message": message},
        ),
        headers={"Retry-After": str(retry_after)} if retry_after is not None else None,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    if request.url.path == "/api/v1/route":
        return JSONResponse(
            status_code=422,
            content=_route_envelope(
                status="error",
                route=None,
                surface=None,
                error={
                    "code": "invalid_request",
                    "message": "Invalid request payload",
                },
            ),
        )

    return await request_validation_exception_handler(request, exc)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Bike Route API"}

@app.post("/analyze-surface")
def analyze_surface(data: LineString):
    if not data.coordinates:
        raise HTTPException(status_code=400, detail={"code": "empty_coordinates", "message": "No coordinates provided"})

    lat, lon = data.coordinates[0][1], data.coordinates[0][0]
    try:
        result = query_overpass_surface(lat, lon)
        return result
    except OverpassError as exc:
        logger.warning("[analyze-surface] %s (%s)", exc.code, str(exc))
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "code": exc.code,
                "message": str(exc),
            },
        ) from exc


@app.post("/api/v1/route")
def route_with_surface(data: RouteRequest):
    if not _route_api_enabled():
        return _route_rejection(503, "routes_disabled", "Route API is disabled")

    if data.profile != "cycling-regular":
        return JSONResponse(
            status_code=422,
            content=_route_envelope(
                status="error",
                route=None,
                surface=None,
                error={
                    "code": "invalid_request",
                    "message": "Only profile='cycling-regular' is supported",
                },
            ),
        )

    if not is_api_key_configured():
        config_error = ORSConfigError()
        return _route_rejection(
            config_error.status_code, config_error.code, str(config_error)
        )

    guard = route_guard
    rejection = guard.try_acquire()
    if rejection is not None:
        return _route_rejection(
            429,
            rejection.code,
            rejection.message,
            retry_after=rejection.retry_after,
            warn=True,
        )

    start = (float(data.start[0]), float(data.start[1]))
    end = (float(data.end[0]), float(data.end[1]))

    try:
        ors_payload = fetch_ors_route(start=start, end=end, profile=data.profile)
        route_payload = extract_route_payload(ors_payload)
    except ORSError as exc:
        logger.warning("[route-with-surface] %s (%s)", exc.code, str(exc))
        return JSONResponse(
            status_code=exc.status_code,
            content=_route_envelope(
                status="error",
                route=None,
                surface=None,
                error={
                    "code": exc.code,
                    "message": str(exc),
                },
            ),
        )
    except Exception:
        logger.exception("[route-with-surface] internal error")
        return JSONResponse(
            status_code=500,
            content=_route_envelope(
                status="error",
                route=None,
                surface=None,
                error={
                    "code": "internal_error",
                    "message": "Unexpected internal error",
                },
            ),
        )
    finally:
        guard.release()

    try:
        surface_payload = extract_surface_payload(ors_payload)
        return _route_envelope(
            status="ok",
            route=route_payload,
            surface=surface_payload,
            error=None,
        )
    except SurfaceDataError as exc:
        logger.warning("[route-with-surface] %s (%s)", exc.code, str(exc))
        return _route_envelope(
            status="partial",
            route=route_payload,
            surface=None,
            error={
                "code": exc.code,
                "message": str(exc),
            },
        )
    except Exception:
        logger.exception("[route-with-surface] internal error")
        return JSONResponse(
            status_code=500,
            content=_route_envelope(
                status="error",
                route=None,
                surface=None,
                error={
                    "code": "internal_error",
                    "message": "Unexpected internal error",
                },
            ),
        )
