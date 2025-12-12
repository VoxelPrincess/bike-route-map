export async function pingBackend() {
  const res = await fetch("/api/ping");
  return res.json();
}
