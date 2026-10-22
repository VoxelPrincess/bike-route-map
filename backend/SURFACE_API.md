# Surface analysis

`POST /analyze-surface` accepts a GeoJSON-like object with `type` and
`coordinates`. Coordinates use longitude, latitude order. The current
implementation queries surface-tagged roads within 50 metres of the first
point and counts objects by surface type. Percentages are not route-length
proportions. Successful responses retain the existing format, for example
`{"asphalt": 66.7, "gravel": 33.3}`.

## Errors

Handled analysis errors return JSON with `detail.code` and `detail.message`.
Request-schema validation errors use FastAPI's standard `detail` list.

| HTTP status | Meaning |
| --- | --- |
| 400 | Empty coordinates list (`empty_coordinates`) |
| 422 | Invalid request schema, including a coordinate with fewer than two values |
| 502 | Overpass rejected the request, returned invalid JSON/data, or supplied no usable surface data |
| 503 | Connection or other request transport failure |
| 504 | Upstream request timeout |

Unavailable analysis is not represented by an empty successful breakdown.
The frontend continues to return `null` for non-OK responses.
CORS allows `http://localhost:5173` and `http://127.0.0.1:5173`; other origins
are not enabled by this change.

## Upstream requests and HTTP 406

Requests use a 6-second connect/read timeout. This is not a total endpoint
deadline. A 406 response triggers at most one retry with an explicit
`bike-route-map/1.0` User-Agent. Both attempts have the same timeout.

The reported diagnostic probe on 2026-10-22 returned 406 with curl's default
User-Agent and 502 with a custom User-Agent. These results do not establish
that the header caused or fixed the rejection. The probe also did not test
the default python-requests header directly. A successful retry is logged
as an observation, not proof of causation. Live Overpass availability is
not required by the automated tests.

## Cache

- Successful breakdowns are cached for 120 seconds using a monotonic clock.
- Each process retains at most 128 entries, evicting the least recently used.
- Keys contain latitude and longitude rounded to six decimal places and
  the query radius. Nearby coordinates within the same rounded key share
  an entry; the upstream query still uses the supplied coordinates.
- Failures and empty results are not cached. Expired entries are refreshed
  on the next request.
- Cache operations are protected by a lock; network calls run outside it.
  Concurrent misses may issue duplicate requests.
- The cache is not shared across workers and is cleared on process restart.

## Verification

From `backend`, with the local virtual environment activated:

```bash
python -m unittest discover -s tests -p 'test_*.py' -v
```

The suite covers success, upstream errors, malformed and empty data, retry
behavior, TTL, eviction, concurrent cache access, and HTTP request validation
and response serialization through ASGI. External requests are mocked.

On 2026-10-22, all 19 tests passed. A separate local Uvicorn check on a free
loopback port verified POST responses 200, 400, 422, 502, 503 and 504, JSON
bodies, and CORS headers for `http://localhost:5173`. The analysis function
was mocked for this HTTP check; it does not confirm live Overpass recovery.
The temporary server was stopped after verification.

The local Python 3.9 environment emits urllib3's LibreSSL compatibility
warning. It did not prevent offline verification, but these checks do not
validate that environment's TLS connectivity to Overpass.
