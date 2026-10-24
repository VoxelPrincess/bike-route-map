import { MapContainer, TileLayer, GeoJSON, Marker, Tooltip, Pane } from 'react-leaflet';
import * as L from 'leaflet';
import { useState } from 'react';
import { isSampleMode } from '../api/routeApi';
import type { Coordinates } from '../api/routeApi';
import { useRoute } from '../hooks/useRoute';
import MapClickHandler from './MapClickHandler';
import './Map.css';

const helsinkiCoords: [number, number] = [60.1699, 24.9384];
const aIcon = L.icon({ iconUrl: '/icons/point-a.svg', iconSize: [34, 40], iconAnchor: [17, 40] });
const bIcon = L.icon({ iconUrl: '/icons/point-b.svg', iconSize: [34, 40], iconAnchor: [17, 40] });

const Map = () => {
  const [from, setFrom] = useState<Coordinates | null>(null);
  const [to, setTo] = useState<Coordinates | null>(null);
  const { phase, result, message, requestId, clear, retry } = useRoute(from, to);
  const sample = isSampleMode();
  const route = result?.route;
  const metrics = route?.properties;
  const hasMetrics = metrics && (metrics.distance_m !== null || metrics.duration_s !== null);
  const samplePoints = result?.mode === 'sample' ? result.route.geometry.coordinates : null;
  const markerFrom = samplePoints ? samplePoints[0] : from;
  const markerTo = samplePoints ? samplePoints[samplePoints.length - 1] : to;

  let statusMsg = from ? 'Click to select point B' : 'Click to select point A';
  if (phase === 'loading') statusMsg = sample ? 'Loading demo route…' : 'Finding route…';
  else if (phase === 'error') statusMsg = message ?? 'Could not load the route.';
  else if (phase === 'ready') statusMsg = 'Route is shown. Reset to select new points.';

  function reset() {
    clear();
    setFrom(null);
    setTo(null);
  }

  return (
    <>
      <div className="route-controls">
        <div className="route-controls__row">
          {from && to && <button className="route-controls__button" onClick={reset}>Reset route</button>}
          <span className="route-controls__status" role={phase === 'error' ? 'alert' : 'status'}>{statusMsg}</span>
          {phase === 'error' && from && to && <button className="route-controls__button" onClick={retry}>Try again</button>}
          {sample && <span className="route-controls__demo" title="Fixed sample route; no live surface analysis">Demo · fixed route</span>}
        </div>
        {hasMetrics && (
          <div className="route-controls__details" aria-label="Route details">
            {metrics.distance_m !== null && <span>Distance: {(metrics.distance_m / 1000).toFixed(2)} km</span>}
            {metrics.duration_s !== null && <span>Time: {Math.round(metrics.duration_s / 60)} min</span>}
          </div>
        )}
        {result?.status === 'partial' && (
          <div className="route-controls__notice" role="status">Surface coverage unavailable. {result.error.message}</div>
        )}
      </div>
      <MapContainer center={helsinkiCoords} zoom={13} scrollWheelZoom style={{ height: '100vh', width: '100%' }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapClickHandler from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <Pane name="route" style={{ zIndex: 400 }}>
          {route && <GeoJSON key={requestId} data={route} style={{ weight: 6, color: '#7c3aed' }} />}
        </Pane>
        <Pane name="route-markers" style={{ zIndex: 450 }}>
          {markerFrom && (
            <Marker position={[markerFrom[1], markerFrom[0]]} icon={aIcon}>
              <Tooltip className="label" direction="right" offset={[10, -16]} permanent>Start: A</Tooltip>
            </Marker>
          )}
          {markerTo && (
            <Marker position={[markerTo[1], markerTo[0]]} icon={bIcon}>
              <Tooltip className="label" direction="right" offset={[10, -16]} permanent>End: B</Tooltip>
            </Marker>
          )}
        </Pane>
      </MapContainer>
    </>
  );
};

export default Map;
