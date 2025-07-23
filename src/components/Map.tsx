import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import { fetchBikeRoute, testCoordinates } from "../api/orsApi";
import RouteLayer from "./RouteLayer";

const helsinkiCoords: [number, number] = [60.1699, 24.9384];

const Map = () => {
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [routeData, setRouteData] = useState<any>(null);

  useEffect(() => {
    // Load surface data from test file
    fetch('/test.geojson')
      .then(response => response.json())
      .then(data => {
        console.log('Loaded GeoJSON features:', data.features.length);
        console.log('Surface types found:', data.features.map((f: any) => f.properties.surface));
        setGeoJsonData(data);
      })
      .catch(error => {
        console.error('Failed to load geojson:', error);
      });

    // Test ORS API
    fetchBikeRoute(testCoordinates.startPoint, testCoordinates.endPoint)
      .then(routeData => {
        setRouteData(routeData);
        console.log('ORS API test successful!');
        console.log('Route features:', routeData.features?.length);
        console.log('Route geometry type:', routeData.features?.[0]?.geometry?.type);
      })
      .catch(error => {
        console.error('ORS API test failed:', error);
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


  // ...existing code...
  return (
    <MapContainer center={helsinkiCoords} zoom={13} scrollWheelZoom={true} style={{ height: "100vh", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
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
