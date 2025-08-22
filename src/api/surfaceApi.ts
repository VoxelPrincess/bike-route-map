type SurfaceBreakdown = unknown;

const RAW_BASE = import.meta.env.VITE_API_BASE as string | undefined;
const API_BASE = RAW_BASE ? RAW_BASE.replace(/\/$/, "") : undefined;

export async function fetchSurfaceBreakdown(
  lineStringGeoJson: any
): Promise<SurfaceBreakdown | null> {
  if (!API_BASE) {
    console.info("[surface-api] Skipped: no VITE_API_BASE (no backend on prod yet)");
    return null;
  }
  try {
    const res = await fetch(`${API_BASE}/analyze-surface`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lineStringGeoJson),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as SurfaceBreakdown;
  } catch (err) {
    console.warn("[surface-api] request failed:", err);
    return null;
  }
}