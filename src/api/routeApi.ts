import type { Feature, LineString } from 'geojson';

export type Coordinates = [number, number];
export type RouteFeature = Feature<LineString, {
  distance_m: number;
  duration_s: number;
  source: 'ors';
}>;
export type SurfaceData = {
  source: 'ors.extra_info.surface';
  summary: { surface_code: number; surface: string; distance_m: number; percent: number }[];
  segments: { surface_code: number; surface: string; index_start: number; index_end: number }[];
};
export type ApiError = { code: string; message: string };
export type LiveRouteResult =
  | { status: 'ok'; mode: 'live'; route: RouteFeature; surface: SurfaceData; error: null }
  | { status: 'partial'; mode: 'live'; route: RouteFeature; surface: null; error: ApiError };
export type SampleRouteResult = {
  status: 'sample'; mode: 'sample';
  route: Feature<LineString, { distance_m: number | null; duration_s: number | null; source: 'sample' }>;
  surface: null; error: null;
};
export type RouteResult = LiveRouteResult | SampleRouteResult;

export class RouteRequestError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'RouteRequestError';
    this.code = code;
  }
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const nonnegative = (value: unknown): value is number => finite(value) && value >= 0;
const integer = (value: unknown): value is number => finite(value) && Number.isInteger(value);

function isGeometry(value: unknown): value is LineString {
  return record(value) && value.type === 'LineString' && Array.isArray(value.coordinates)
    && value.coordinates.length >= 2 && value.coordinates.every(point =>
      Array.isArray(point) && point.length >= 2 && point.every(finite)
      && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90);
}

function isRoute(value: unknown): value is RouteFeature {
  return record(value) && value.type === 'Feature' && isGeometry(value.geometry)
    && record(value.properties) && value.properties.source === 'ors'
    && finite(value.properties.distance_m) && value.properties.distance_m > 0
    && nonnegative(value.properties.duration_s);
}

function isError(value: unknown): value is ApiError {
  return record(value) && typeof value.code === 'string' && value.code.length > 0
    && typeof value.message === 'string' && value.message.length > 0;
}

function isSurface(value: unknown): value is SurfaceData {
  return record(value) && value.source === 'ors.extra_info.surface'
    && Array.isArray(value.summary) && value.summary.length > 0
    && value.summary.every(row => record(row) && integer(row.surface_code)
      && typeof row.surface === 'string' && nonnegative(row.distance_m)
      && nonnegative(row.percent) && row.percent <= 100)
    && Array.isArray(value.segments) && value.segments.length > 0
    && value.segments.every(row => record(row) && integer(row.surface_code)
      && typeof row.surface === 'string' && integer(row.index_start) && row.index_start >= 0
      && integer(row.index_end) && row.index_end > row.index_start);
}

function invalidResponse(): never {
  throw new RouteRequestError('invalid_response', 'The routing service returned an invalid response. Please try again.');
}

function parseLiveResult(value: unknown, response: Response): LiveRouteResult {
  if (!record(value) || value.mode !== 'live') return invalidResponse();
  if (!response.ok) {
    if (value.status === 'error' && value.route === null && value.surface === null && isError(value.error)) {
      throw new RouteRequestError(value.error.code, value.error.message);
    }
    return invalidResponse();
  }
  if (response.status !== 200 || !isRoute(value.route)) return invalidResponse();
  if (value.status === 'partial' && value.surface === null && isError(value.error)) {
    return { status: 'partial', mode: 'live', route: value.route, surface: null, error: value.error };
  }
  if (value.status === 'ok' && isSurface(value.surface) && value.error === null) {
    return { status: 'ok', mode: 'live', route: value.route, surface: value.surface, error: null };
  }
  return invalidResponse();
}

function parseSample(value: unknown): SampleRouteResult {
  const feature = record(value) && value.type === 'FeatureCollection'
    && Array.isArray(value.features) ? value.features[0] : null;
  if (!record(feature) || feature.type !== 'Feature' || !isGeometry(feature.geometry)) {
    throw new RouteRequestError('sample_invalid', 'The demo route is invalid. Please reload the page.');
  }
  const summary = record(feature.properties) && record(feature.properties.summary)
    ? feature.properties.summary : {};
  return {
    status: 'sample', mode: 'sample', surface: null, error: null,
    route: { type: 'Feature', geometry: feature.geometry, properties: {
      source: 'sample',
      distance_m: finite(summary.distance) && summary.distance > 0 ? summary.distance : null,
      duration_s: nonnegative(summary.duration) ? summary.duration : null,
    } },
  };
}

export function isSampleMode(): boolean {
  return import.meta.env.VITE_USE_SAMPLE === '1';
}

export async function fetchRouteAB(start: Coordinates, end: Coordinates, signal: AbortSignal): Promise<RouteResult> {
  const sample = isSampleMode();
  const base = (import.meta.env.VITE_API_BASE as string | undefined)?.trim().replace(/\/+$/, '');
  if (!sample && !base) {
    throw new RouteRequestError('backend_not_configured', 'Live routing is not configured.');
  }
  try {
    const response = sample
      ? await fetch('/sample-route.json', { signal, cache: 'no-store' })
      : await fetch(`${base}/api/v1/route`, {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end, profile: 'cycling-regular' }),
      });
    if (sample && !response.ok) {
      throw new RouteRequestError('sample_unavailable', 'The demo route could not be loaded. Please try again.');
    }
    const payload: unknown = await response.json().catch(() => {
      throw new RouteRequestError('invalid_response', sample
        ? 'The demo route could not be read.'
        : 'The routing service returned an unreadable response. Please try again.');
    });
    return sample ? parseSample(payload) : parseLiveResult(payload, response);
  } catch (error) {
    if (signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
    if (error instanceof RouteRequestError) throw error;
    throw new RouteRequestError('network_error', sample
      ? 'The demo route could not be loaded. Please try again.'
      : 'Cannot reach the routing service. Please try again.');
  }
}
