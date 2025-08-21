from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from .query_overpass_surface import query_overpass_surface

app = FastAPI()

class LineString(BaseModel):
    type: str
    coordinates: List[List[float]]

@app.post("/analyze-surface")
def analyze_surface(data: LineString):
    lat, lon = data.coordinates[0][1], data.coordinates[0][0]
    result = query_overpass_surface(lat, lon)
    return result 