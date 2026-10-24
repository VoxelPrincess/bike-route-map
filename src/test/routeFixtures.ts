import type { LiveRouteResult } from '../api/routeApi';

export function liveResult(distance = 1200): LiveRouteResult {
  return {
    status: 'ok', mode: 'live', error: null,
    route: { type: 'Feature', geometry: { type: 'LineString', coordinates: [[24.94, 60.17], [24.96, 60.20]] },
      properties: { distance_m: distance, duration_s: 420, source: 'ors' } },
    surface: { source: 'ors.extra_info.surface',
      summary: [{ surface_code: 3, surface: 'asphalt', distance_m: distance, percent: 100 }],
      segments: [{ surface_code: 3, surface: 'asphalt', index_start: 0, index_end: 1 }] },
  };
}

export function partialResult(): LiveRouteResult {
  return { ...liveResult(), status: 'partial', surface: null,
    error: { code: 'surface_unavailable', message: 'Surface data is missing.' } };
}

export const sampleRoute = {
  type: 'FeatureCollection', features: [{ type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[24.93, 60.16], [24.95, 60.18]] }, properties: {} }],
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
