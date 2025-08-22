
// OpenRouteService API integration for bike routing
const ORS_API_BASE = 'https://api.openrouteservice.org/v2';
const API_KEY = import.meta.env.VITE_ORS_API_KEY;
const USE_SAMPLE = import.meta.env.VITE_USE_SAMPLE === '1';

// Example coordinates for Helsinki (for testing/demo)
export const testCoordinates = {
  startPoint: [24.941, 60.1709] as [number, number],  // Helsinki city center
  endPoint: [24.962, 60.2049] as [number, number]     // North Helsinki
};

export async function fetchBikeRoute(
  start: [number, number],
  end: [number, number]
) {
  if (USE_SAMPLE) {
    // Demo mode: do not call ORS, always use local sample file (no cache)
    const url = `/sample-route.json?v=${Date.now()}`;
    console.info('[route-fetch] mode=sample', url);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`sample ${res.status}`);
    return await res.json(); // GeoJSON
  }

  // Real ORS request (used in development/local only)
  const key = import.meta.env.VITE_ORS_API_KEY ?? '';
  const url = 'https://api.openrouteservice.org/v2/directions/cycling-regular/geojson';
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: [[start[0], start[1]], [end[0], end[1]]] }),
    });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch (e) {
    // On error, fallback to sample route
    console.warn('[route-fetch] ORS failed, fallback to sample:', e);
    const r = await fetch(`/sample-route.json?v=${Date.now()}`, { cache: 'no-store' });
    return await r.json();
  }
}
