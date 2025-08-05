export async function fetchSurfaceBreakdown(lineStringGeoJson: any) {
  const response = await fetch('/analyze-surface', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(lineStringGeoJson)
  });

  if (!response.ok) {
    throw new Error(`[surface-api] ${response.status} ${response.statusText}`);
  }

  return await response.json();
}