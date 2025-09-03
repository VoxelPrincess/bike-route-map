import fetch from "node-fetch";

export default async function (context, req) {
  const key = process.env.ORS_API_KEY;
  if (!key) {
    return { status: 500, json: { error: "Missing ORS_API_KEY" } };
  }

  const res = await fetch("https://api.openrouteservice.org/v2/directions/cycling-regular/geojson", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: key }, // Убедитесь, что заголовок Authorization передаётся
    body: JSON.stringify(req.body),
  });

  const json = await res.json();
  return { status: res.status, json };
}
