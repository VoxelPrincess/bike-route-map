import { MapContainer, TileLayer, GeoJSON, Marker, Tooltip, useMap } from "react-leaflet";
import * as L from "leaflet";
import { useEffect as useEffectPane } from "react";
import React, { useEffect, useState } from "react";
import { fetchRouteAB } from "../api/orsApi";
import RouteLayer from "./RouteLayer";
import MapClickHandler from "./MapClickHandler";
import { fetchSurfaceBreakdown } from "../api/surfaceApi";
import { SurfaceBarTextChart } from "./analytics/SurfaceBarChart";

const helsinkiCoords: [number, number] = [60.1699, 24.9384];

const Map = () => {
  const [from, setFrom] = useState<[number, number] | null>(null);
  const [to, setTo] = useState<[number, number] | null>(null);
  const [routeData, setRouteData] = useState<any>(null);
  const [surfaceBreakdown, setSurfaceBreakdown] = useState<Record<string, number> | null>(null);
  const [routeSummary, setRouteSummary] = useState<{ distance: number; duration: number } | null>(null);

  const aIcon = L.icon({
    iconUrl: '/icons/point-a.svg',
    iconSize: [34, 40],
    iconAnchor: [17, 40],
  });
  const bIcon = L.icon({
    iconUrl: '/icons/point-b.svg',
    iconSize: [34, 40],
    iconAnchor: [17, 40],
  });

  const PaneSetup = () => {
    const map = useMap();
    useEffectPane(() => {
      if (!map.getPane('route')) {
        map.createPane('route');
        map.getPane('route')!.style.zIndex = '400';
      }
      if (!map.getPane('markers')) {
        map.createPane('markers');
        map.getPane('markers')!.style.zIndex = '450';
      }
    }, [map]);
    return null;
  };

  useEffect(() => {
    if (from && to) {
      fetchRouteAB(from, to)
        .then(routeData => {
          setRouteData(routeData);
          const summary = routeData?.features?.[0]?.properties?.summary;
          if (summary && typeof summary.distance === 'number' && typeof summary.duration === 'number') {
            setRouteSummary({ distance: summary.distance, duration: summary.duration });
          } else {
            setRouteSummary(null);
          }
        })
        .catch(error => {
          setRouteData(null);
          setRouteSummary(null);
          console.error('[route-fetch] Failed to fetch route A-B:', error);
        });
    }
  }, [from, to]);

  useEffect(() => {
    if (routeData?.features?.[0]?.geometry) {
      fetchSurfaceBreakdown(routeData.features[0].geometry)
        .then(data => setSurfaceBreakdown(data))
        .catch(err => {
          setSurfaceBreakdown(null);
          console.error('[surface-breakdown] Error:', err);
        });
    }
  }, [routeData]);

  let statusMsg = "Click to select point A";
  if (from && !to) statusMsg = "Click to select point B";
  else if (from && to) statusMsg = "Route is shown. Reset to select new points.";

  const handleResetClick = () => {
    setFrom(null);
    setTo(null);
    setRouteData(null);
    setSurfaceBreakdown(null);
    setRouteSummary(null);
  };

  return (
    <>
      <div style={{ position: "absolute", top: 30, left: 100, zIndex: 1000 }}>
        {from && to && (
          <button
            onClick={handleResetClick}
            style={{ marginRight: 12, fontWeight: "bold", fontSize: "1rem", padding: "6px 16px" }}
          >
            Reset route
          </button>
        )}
        <span style={{
          fontWeight: "bold",
          fontSize: "1rem",
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 2px 8px #0001",
          padding: "6px 16px"
        }}>{statusMsg}</span>
      </div>

      {surfaceBreakdown && (
        <div style={{
          position: "absolute",
          top: 80,
          left: 100,
          zIndex: 1000,
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 2px 8px #0001",
          padding: 16
        }}>
          <SurfaceBarTextChart
            bare
            data={surfaceBreakdown}
            distance={routeSummary?.distance}
            duration={routeSummary?.duration}
          />
        </div>
      )}

      <MapContainer center={helsinkiCoords} zoom={13} scrollWheelZoom={true} style={{ height: "100vh", width: "100%" }}>
        <PaneSetup />
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler from={from} to={to} setFrom={setFrom} setTo={setTo} />
        {from && (
          <Marker pane="markers" position={[from[1], from[0]]} icon={aIcon}>
            <Tooltip className="label" direction="right" offset={[10, -16]} permanent>Start: A</Tooltip>
          </Marker>
        )}
        {to && (
          <Marker pane="markers" position={[to[1], to[0]]} icon={bIcon}>
            <Tooltip className="label" direction="left" offset={[-10, -16]} permanent>End: B</Tooltip>
          </Marker>
        )}
        {routeData && (
          <GeoJSON pane="route" data={routeData} style={{ weight: 6, color: '#7c3aed' }} />
        )}
      </MapContainer>
    </>
  );
};

export default Map;
