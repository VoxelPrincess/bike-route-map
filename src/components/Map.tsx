import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
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


  return (
    <MapContainer center={helsinkiCoords} zoom={13} scrollWheelZoom={true} style={{ height: "100vh", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickHandler from={from} to={to} setFrom={setFrom} setTo={setTo} />
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
  );
};

export default Map;
