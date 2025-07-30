import { MapContainer, TileLayer, GeoJSON, Marker, Tooltip } from "react-leaflet";
import React, { useEffect, useState } from "react";
import { fetchBikeRoute } from "../api/orsApi";
import RouteLayer from "./RouteLayer";
import MapClickHandler from "./MapClickHandler";

const helsinkiCoords: [number, number] = [60.1699, 24.9384];

const Map = () => {
  const [geoJsonData, setGeoJsonData] = useState<any>(null);

  // Add state for route points
  const [from, setFrom] = useState<[number, number] | null>(null);
  const [to, setTo] = useState<[number, number] | null>(null);
  const [routeData, setRouteData] = useState<any>(null);

  // Fetch route when both points are selected
  useEffect(() => {
    if (from && to) {
      fetchBikeRoute(from, to)
        .then(routeData => setRouteData(routeData))
        .catch(error => {
          setRouteData(null);
          console.error('[route-fetch] Failed to fetch route A-B:', error);
        });
    }
  }, [from, to]);

  // Load surface data from test file
  useEffect(() => {
    fetch('/test.geojson')
      .then(response => response.json())
      .then(data => setGeoJsonData(data))
      .catch(error => {
        console.error('[geojson-load] Failed to load GeoJSON data:', error);
      });
  }, []);

  const surfaceStyles = {
    asphalt: { color: '#333333', weight: 4 },
    gravel: { color: '#8B4513', weight: 4 },
    cobblestone: { color: '#708090', weight: 4 }
  };

  const getFeatureStyle = (feature: any) => {
    const surfaceType = feature.properties.surface;
    return surfaceStyles[surfaceType as keyof typeof surfaceStyles] || { color: '#FF0000', weight: 4 };
  };


  // Guidance message
  let statusMsg = "Click to select point A";
  if (from && !to) statusMsg = "Click to select point B";
  else if (from && to) statusMsg = "Route is shown. Reset to select new points.";

  return (
    <>
      <div style={{ position: "absolute", top: 30, left: 100, zIndex: 1000 }}>
        <button 
          onClick={() => { setFrom(null); setTo(null); setRouteData(null); }} 
          style={{ marginRight: 12, fontWeight: "bold", fontSize: "1rem", padding: "6px 16px" }}
        >
          Reset route
        </button>
        <span style={{ fontWeight: "bold", fontSize: "1rem" }}>{statusMsg}</span>
      </div>
      <MapContainer center={helsinkiCoords} zoom={13} scrollWheelZoom={true} style={{ height: "100vh", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler from={from} to={to} setFrom={setFrom} setTo={setTo} />
        {/* Show A/B markers before route is fetched */}
        {from && (
          <Marker position={[from[1], from[0]]}>
            <Tooltip direction="top" offset={[0, -10]} permanent>Start: A</Tooltip>
          </Marker>
        )}
        {to && (
          <Marker position={[to[1], to[0]]}>
            <Tooltip direction="top" offset={[0, -10]} permanent>End: B</Tooltip>
          </Marker>
        )}
        {geoJsonData && (
          <GeoJSON 
            data={geoJsonData} 
            style={getFeatureStyle}
            onEachFeature={(feature, layer) => {
              layer.bindPopup(feature.properties.surface);
            }}
          />
        )}
        {routeData && (
          <RouteLayer routeData={routeData} />
        )}
      </MapContainer>
    </>
  );
};

export default Map;
