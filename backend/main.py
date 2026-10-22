from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Annotated, List
import logging

from query_overpass_surface import (
    OverpassError,
    query_overpass_surface,
)

app = FastAPI()
logger = logging.getLogger(__name__)

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
