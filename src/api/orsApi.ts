// OpenRouteService API integration for bike routing

const ORS_API_BASE = 'https://api.openrouteservice.org/v2';
const API_KEY = import.meta.env.VITE_ORS_API_KEY;
const USE_SAMPLE = import.meta.env.VITE_USE_SAMPLE === '1';

// Fixed coordinates for testing in Helsinki
export const testCoordinates = {
  startPoint: [24.941, 60.1709] as [number, number],  // Helsinki center
  endPoint: [24.962, 60.2049] as [number, number]     // North Helsinki
};

export async function fetchBikeRoute(start: [number, number], end: [number, number]) {
  const url = `${ORS_API_BASE}/directions/cycling-regular/geojson`;
  const requestBody = {
    coordinates: [start, end],
    instructions: false
  };

  if (USE_SAMPLE) {
    const r = await fetch('/sample-route.json');
    return r.json();
  }

  try {
    console.log('[route-fetch] Sending request to ORS...');
    console.log(`[route-fetch] Start: ${start.join(', ')} | End: ${end.join(', ')}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json, application/geo+json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`ORS API error: ${response.status} ${response.statusText}`);
    }

    const routeData = await response.json();
    console.log('[route-fetch] Segments:', routeData.features?.length);
    return routeData;
  } catch (error) {
    console.error('[route-fetch] Failed to fetch route A→B:', error);
    // fallback to sample
    const r = await fetch('/sample-route.json');
    return r.json();
  }
}
