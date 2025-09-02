from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from .query_overpass_surface import query_overpass_surface

app = FastAPI()

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
    coordinates: List[List[float]]

@app.get("/")
def read_root():
    return {"message": "Welcome to the Bike Route API"}

@app.post("/analyze-surface")
def analyze_surface(data: LineString):
    lat, lon = data.coordinates[0][1], data.coordinates[0][0]
    result = query_overpass_surface(lat, lon)
    return result