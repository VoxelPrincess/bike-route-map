import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRouteAB } from './routeApi';
import { jsonResponse, liveResult, partialResult, sampleRoute } from '../test/routeFixtures';

const start: [number, number] = [24.94, 60.17];
const end: [number, number] = [24.96, 60.20];
const request = () => fetchRouteAB(start, end, new AbortController().signal);

beforeEach(() => {
  vi.stubEnv('VITE_USE_SAMPLE', '0');
  vi.stubEnv('VITE_API_BASE', 'http://localhost:8000/');
});

describe('backend routing', () => {
  it('posts lon/lat to the backend once, preserving the complete result', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(liveResult()));
    vi.stubGlobal('fetch', fetch);
    expect(await request()).toEqual(liveResult());
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/v1/route');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options.body)).toEqual({ start, end, profile: 'cycling-regular' });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('preserves a partial route and the surface error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(partialResult())));
    expect(await request()).toEqual(partialResult());
  });

  it.each([401, 422, 502, 503, 504])('reads an error envelope for HTTP %s without sample fallback', async status => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ status: 'error', mode: 'live', route: null,
      surface: null, error: { code: 'ors_unavailable', message: 'Please try later.' } }, status));
    vi.stubGlobal('fetch', fetch);
    await expect(request()).rejects.toMatchObject({ code: 'ors_unavailable', message: 'Please try later.' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reports a network failure without fallback or raw exception text', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('internal transport details'));
    vi.stubGlobal('fetch', fetch);
    await expect(request()).rejects.toMatchObject({ code: 'network_error', message: 'Cannot reach the routing service. Please try again.' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('handles a non-JSON proxy error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<h1>Bad Gateway</h1>', { status: 502 })));
    await expect(request()).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it.each([{}, { ...liveResult(), mode: 'sample' }, { ...liveResult(), route: null },
    { ...partialResult(), surface: {} }, { ...liveResult(), surface: { summary: [], segments: [] } }])(
    'rejects malformed successful envelopes', async body => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)));
      await expect(request()).rejects.toMatchObject({ code: 'invalid_response' });
    });

  it('rejects surface segments that extend beyond the returned route geometry', async () => {
    const body = liveResult();
    const surface = body.surface;
    if (!surface) throw new Error('Expected an ORS surface result.');
    surface.segments[0].index_end = 2;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)));
    await expect(request()).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('reports missing backend configuration without making a request', async () => {
    vi.stubEnv('VITE_API_BASE', '');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(request()).rejects.toMatchObject({ code: 'backend_not_configured' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('propagates cancellation separately from user-facing errors', async () => {
    const controller = new AbortController(); controller.abort();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')));
    await expect(fetchRouteAB(start, end, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('explicit sample mode', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_SAMPLE', '1'); vi.stubEnv('VITE_API_BASE', ''); });

  it('loads only the local file and does not invent missing metrics or coverage', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(sampleRoute)); vi.stubGlobal('fetch', fetch);
    const result = await request();
    expect(result.mode).toBe('sample');
    expect(result.surface).toBeNull();
    expect(result.route.geometry).toEqual(sampleRoute.features[0].geometry);
    expect(result.route.properties).toEqual({ source: 'sample', distance_m: null, duration_s: null });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('/sample-route.json');
  });

  it('adapts metrics when actually supplied in the sample', async () => {
    const sample = structuredClone(sampleRoute);
    sample.features[0].properties = { summary: { distance: 2000, duration: 0 } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(sample)));
    expect((await request()).route.properties).toEqual({ source: 'sample', distance_m: 2000, duration_s: 0 });
  });

  it('reports a missing sample without trying live routing', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 404 })); vi.stubGlobal('fetch', fetch);
    await expect(request()).rejects.toMatchObject({ code: 'sample_unavailable' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed sample geometry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ features: [] })));
    await expect(request()).rejects.toMatchObject({ code: 'sample_invalid' });
  });
});
