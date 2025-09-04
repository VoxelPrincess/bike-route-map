// src/api/surfaceApi.ts
type SurfaceBreakdown = unknown;

// Normalize BASE: remove trailing slash if present
const RAW_BASE = import.meta.env.VITE_API_BASE as string | undefined;
export const API_BASE = RAW_BASE ? RAW_BASE.replace(/\/$/, "") : undefined;

// Handy flag - useful in UI to hide blocks if there is no backend
export const SURFACE_API_ENABLED = Boolean(API_BASE);

/**
 * Returns JSON with coverage breakdown or null if the backend is not configured/down.
 */
export async function fetchSurfaceBreakdown(lineStringGeoJson: any): Promise<SurfaceBreakdown | null> {
  if (!SURFACE_API_ENABLED) {
    console.info("[surface-api] Skipped: no VITE_API_BASE (no backend on prod yet)");
    return null;
  }

  try {
    const res = await fetch(`${API_BASE}/analyze-surface`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lineStringGeoJson),
    });

    if (!res.ok) {
      console.warn(`[surface-api] ${res.status} ${res.statusText}`);
      return null;
    }

    return (await res.json()) as SurfaceBreakdown;
  } catch (err) {
    console.warn("[surface-api] request failed:", err);
    return null;
  }
}
