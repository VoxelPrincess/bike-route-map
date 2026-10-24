import { MapContainer, TileLayer, GeoJSON, Marker, Tooltip, Pane, Polyline } from 'react-leaflet';
import * as L from 'leaflet';
import { useState } from 'react';
import { isSampleMode } from '../api/routeApi';
import type { Coordinates } from '../api/routeApi';
import { useRoute } from '../hooks/useRoute';
import type { Place } from '../types/place';
import { SurfaceBarTextChart } from './analytics/SurfaceBarChart';
import { surfaceColor, surfaceDashArray, surfaceLabel } from './analytics/surfacePresentation';
import MapClickHandler from './MapClickHandler';
import './Map.css';

const helsinkiCoords: [number, number] = [60.1699, 24.9384];
const aIcon = L.icon({ iconUrl: '/icons/point-a.svg', iconSize: [34, 40], iconAnchor: [17, 40] });
const bIcon = L.icon({ iconUrl: '/icons/point-b.svg', iconSize: [34, 40], iconAnchor: [17, 40] });
const EARTH_RADIUS_METERS = 6_371_000;

function distanceBetweenCoordinates([longitudeA, latitudeA]: Coordinates, [longitudeB, latitudeB]: Coordinates): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latA = radians(latitudeA);
  const latB = radians(latitudeB);
  const deltaLat = latB - latA;
  const deltaLon = radians(longitudeB - longitudeA);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function lineLengthMeters(coordinates: Coordinates[]): number {
  return coordinates.slice(1).reduce((length, point, index) => (
    length + distanceBetweenCoordinates(coordinates[index], point)
  ), 0);
}

function formatApproximateDistance(distanceMeters: number): string {
  if (distanceMeters < 1) return '< 1 m';
  return distanceMeters < 1000
    ? `${Math.round(distanceMeters)} m`
    : `${(distanceMeters / 1000).toFixed(2)} km`;
}

function formatDuration(durationSeconds: number): string {
  const totalMinutes = Math.round(durationSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

const Map = () => {
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const { phase, result, message, requestId, clear, retry } = useRoute(
    from?.coordinates ?? null,
    to?.coordinates ?? null,
  );
  const sample = isSampleMode();
  const route = result?.route;
  const metrics = route?.properties;
  const hasMetrics = metrics && (metrics.distance_m !== null || metrics.duration_s !== null);
  const hasReadyRoute = phase === 'ready' && Boolean(route);
  const samplePoints = result?.mode === 'sample' ? result.route.geometry.coordinates : null;
  const markerFrom = samplePoints ? samplePoints[0] : from?.coordinates ?? null;
  const markerTo = samplePoints ? samplePoints[samplePoints.length - 1] : to?.coordinates ?? null;
  const rawSurfaceSegments = route && result?.status === 'ok'
    ? result.surface.segments.map(segment => ({
      ...segment,
      geometryLength: lineLengthMeters(route.geometry.coordinates
        .slice(segment.index_start, segment.index_end + 1)
        .map(([longitude, latitude]) => [longitude, latitude] as Coordinates)),
    }))
    : null;
  const geometryLength = rawSurfaceSegments?.reduce((total, segment) => total + segment.geometryLength, 0) ?? 0;
  const distanceScale = route && result?.status === 'ok' && geometryLength > 0
    ? result.route.properties.distance_m / geometryLength
    : 0;
  const surfaceSegments = route && result?.status === 'ok'
    ? rawSurfaceSegments?.map(segment => ({
      positions: route.geometry.coordinates
        .slice(segment.index_start, segment.index_end + 1)
        .map(([longitude, latitude]) => [latitude, longitude] as [number, number]),
      color: surfaceColor(segment.surface),
      label: surfaceLabel(segment.surface),
      distanceMeters: segment.geometryLength * distanceScale,
      dashArray: surfaceDashArray(segment.surface),
    })) ?? []
    : null;

  let statusMsg = from ? 'Click to select point B' : 'Click to select point A';
  if (phase === 'loading') statusMsg = sample ? 'Loading demo route…' : 'Finding route…';
  else if (phase === 'error') statusMsg = message ?? 'Could not load the route.';

  function reset() {
    clear();
    setFrom(null);
    setTo(null);
  }

  return (
    <>
      <div className="route-controls">
        <div className="route-summary" role={hasReadyRoute ? 'status' : 'group'} aria-label="Trip summary">
          {!sample && (
            <div className="route-summary__places" role="group" aria-label="Route points">
              <div className="route-summary__place" role="group" aria-label="Point A">
                <span className="route-summary__point route-summary__point--a">A</span>
                <span className="route-summary__place-label">
                  {from ? from.label ?? 'Map point' : 'Select point A on the map'}
                </span>
                {from && (
                  <button className="route-summary__clear" aria-label="Clear point A" onClick={() => setFrom(null)}>×</button>
                )}
              </div>
              <div className="route-summary__place" role="group" aria-label="Point B">
                <span className="route-summary__point route-summary__point--b">B</span>
                <span className="route-summary__place-label">
                  {to ? to.label ?? 'Map point' : 'Select point B on the map'}
                </span>
                {to && (
                  <button className="route-summary__clear" aria-label="Clear point B" onClick={() => setTo(null)}>×</button>
                )}
              </div>
            </div>
          )}
          <div className="route-summary__footer">
            {!hasReadyRoute && (
              <span className="route-controls__status" role={phase === 'error' ? 'alert' : 'status'}>{statusMsg}</span>
            )}
            {sample && <span className="route-controls__demo" title="Fixed sample route; no live surface analysis">Demo · fixed route</span>}
            {hasReadyRoute && !sample && hasMetrics && (
              <div className="route-summary__metrics" aria-label="Route details">
                {metrics.distance_m !== null && <span>{(metrics.distance_m / 1000).toFixed(2)} km</span>}
                {metrics.distance_m !== null && metrics.duration_s !== null && <span aria-hidden="true">·</span>}
                {metrics.duration_s !== null && <span>{formatDuration(metrics.duration_s)}</span>}
              </div>
            )}
            {phase === 'error' && from && to && <button className="route-controls__button" onClick={retry}>Try again</button>}
            {(from || to) && <button className="route-controls__button" onClick={reset}>Reset</button>}
          </div>
        </div>
        {result?.status === 'partial' && (
          <div className="route-controls__notice" role="status">Surface coverage unavailable. {result.error.message}</div>
        )}
      </div>
      {result?.status === 'ok' && (
        <div className="surface-chart-overlay">
          <SurfaceBarTextChart
            data={result.surface.summary}
          />
        </div>
      )}
      <MapContainer center={helsinkiCoords} zoom={13} scrollWheelZoom style={{ height: '100vh', width: '100%' }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapClickHandler from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <Pane name="route" style={{ zIndex: 400 }}>
          {surfaceSegments ? (
            <>
              {surfaceSegments.map((segment, index) => (
                <Polyline key={`${requestId}-halo-${index}`} positions={segment.positions}
                  pathOptions={{ className: 'route-halo', color: '#fff', dashArray: segment.dashArray,
                    weight: 8, lineCap: 'round', lineJoin: 'round' }} />
              ))}
              {surfaceSegments.map((segment, index) => (
                <Polyline key={`${requestId}-outline-${index}`} positions={segment.positions}
                  pathOptions={{ className: 'route-outline', color: '#1f2937', dashArray: segment.dashArray,
                    weight: 6, lineCap: 'round', lineJoin: 'round' }} />
              ))}
              {surfaceSegments.map((segment, index) => (
                <Polyline key={`${requestId}-surface-${index}`} positions={segment.positions}
                  pathOptions={{ className: 'route-surface', color: segment.color, dashArray: segment.dashArray,
                    weight: 4, lineCap: 'round', lineJoin: 'round' }}>
                  <Tooltip pane="tooltipPane" sticky direction="top" offset={[0, -8]}>
                    {segment.label} · ≈ {formatApproximateDistance(segment.distanceMeters)}
                  </Tooltip>
                </Polyline>
              ))}
            </>
          ) : route && <GeoJSON key={requestId} data={route} style={{ weight: 6, color: '#7c3aed' }} />}
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
