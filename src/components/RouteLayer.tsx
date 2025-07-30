import { GeoJSON, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const surfaceColors: Record<string, string> = {
    asphalt: "#333333",      // dark gray
    gravel: "#8B4513",       // saddle brown
    cobblestone: "#708090",   // slate gray
    dirt: "#a0522d",         // sienna
    sand: "#e2c290",         // sand, if no  #cba664
    grass: "#6b8e23"         // olive drab
};

function getRouteStyle(feature: any) {
  const surface = feature?.properties?.surface;
  return {
    color: surfaceColors[surface] || "#6f42c1",
    weight: 6,
    opacity: 0.8,
    dashArray: "12 10"
  };
}

function RouteLayer({ routeData }: { routeData: any }) {
  const iconA = L.divIcon({
    className: "custom-marker-icon",
    html: '<div style="background:#1976d2;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);">A</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
  const iconB = L.divIcon({
    className: "custom-marker-icon",
    html: '<div style="background:#d32f2f;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);">B</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
  if (!routeData) return null;

  let startCoords: [number, number] | null = null;
  let endCoords: [number, number] | null = null;
  if (routeData.features && routeData.features.length > 0) {
    const coords = routeData.features[0].geometry.coordinates;
    if (Array.isArray(coords) && coords.length > 0 && Array.isArray(coords[0]) && coords[0].length === 2) {
      startCoords = [Number(coords[0][1]), Number(coords[0][0])];
      endCoords = [Number(coords[coords.length - 1][1]), Number(coords[coords.length - 1][0])];
    }
  }
  
    return (
      <>
        <GeoJSON
          data={routeData}
          style={getRouteStyle}
        />
        {startCoords && (
          <Marker position={startCoords} icon={iconA}>
            <Popup>Start</Popup>
          </Marker>
        )}
        {endCoords && (
          <Marker position={endCoords} icon={iconB}>
            <Popup>End</Popup>
          </Marker>
        )}
      </>
    );
}

export default RouteLayer;
