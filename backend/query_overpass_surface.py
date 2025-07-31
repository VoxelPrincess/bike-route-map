import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def query_overpass_surface(lat: float, lon: float, radius: int = 50):
    query = f"""
    [out:json];
    way(around:{radius},{lat},{lon})[highway][surface];
    out body;
    """

    response = requests.post(OVERPASS_URL, data={"data": query})
    response.raise_for_status()
    data = response.json()

    surface_counts = {}
    for element in data.get("elements", []):
        tags = element.get("tags", {})
        surface = tags.get("surface")
        if surface:
            surface_counts[surface] = surface_counts.get(surface, 0) + 1

    total = sum(surface_counts.values())
    surface_percentages = {
        k: round((v / total) * 100, 1)
        for k, v in surface_counts.items()
    } if total > 0 else {}

    return surface_percentages