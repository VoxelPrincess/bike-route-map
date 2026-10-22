import asyncio
import json
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

import main
import query_overpass_surface as qos
from test_surface_error_handling import FakeResponse


async def post_surface(payload):
    """Exercise routing, request validation and HTTP serialization through ASGI."""
    messages = []
    body = json.dumps(payload).encode()

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(message):
        messages.append(message)

    await main.app({
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
        "method": "POST", "scheme": "http", "path": "/analyze-surface",
        "raw_path": b"/analyze-surface", "query_string": b"",
        "headers": [(b"content-type", b"application/json"),
                    (b"origin", b"http://localhost:5173")],
        "server": ("localhost", 8000), "client": ("127.0.0.1", 12345),
        "root_path": "",
    }, receive, send)
    start = next(m for m in messages if m["type"] == "http.response.start")
    content = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body")
    return start, json.loads(content)


class SurfaceValidationTests(unittest.TestCase):
    def setUp(self):
        qos._CACHE.clear()

    def test_malformed_upstream_responses_are_not_cached(self):
        payloads = [ValueError("invalid JSON"), [], {}, {"elements": {}},
                    {"elements": [None]}, {"elements": [{"tags": []}]},
                    {"elements": [{"tags": {"surface": ["asphalt"]}}]},
                    {"elements": [{"tags": {"surface": {"type": "asphalt"}}}]}]
        for payload in payloads:
            with self.subTest(payload=payload), patch.object(qos.requests, "post", return_value=FakeResponse(payload=payload)):
                with self.assertRaises(qos.OverpassBadResponseError):
                    qos.query_overpass_surface(60, 24)
                self.assertEqual(len(qos._CACHE), 0)

    def test_failure_is_retried_on_next_request(self):
        with patch.object(qos.requests, "post", side_effect=[
            FakeResponse(503), FakeResponse(payload={"elements": [{"tags": {"surface": "gravel"}}]})
        ]) as post:
            with self.assertRaises(qos.OverpassError):
                qos.query_overpass_surface(60, 24)
            self.assertEqual(qos.query_overpass_surface(60, 24), {"gravel": 100.0})
            self.assertEqual(post.call_count, 2)

    def test_cache_evicts_least_recently_used_entry(self):
        with patch.object(qos, "CACHE_MAX_ENTRIES", 2):
            qos._cache_set((1, 1, 50), {"asphalt": 100})
            qos._cache_set((2, 2, 50), {"gravel": 100})
            qos._cache_get((1, 1, 50))
            qos._cache_set((3, 3, 50), {"sand": 100})
            self.assertEqual(len(qos._CACHE), 2)
            self.assertIsNone(qos._cache_get((2, 2, 50)))
            self.assertIsNotNone(qos._cache_get((1, 1, 50)))

    def test_concurrent_cache_access_remains_bounded(self):
        def access(worker):
            for i in range(500):
                key = (worker, i % 20, 50)
                qos._cache_set(key, {"asphalt": 100})
                qos._cache_get(key)

        with patch.object(qos, "CACHE_MAX_ENTRIES", 4), ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(access, range(8)))
            self.assertLessEqual(len(qos._CACHE), 4)

    def test_http_validation_and_error_serialization(self):
        cases = [([], 400), ([[]], 422), ([[24.9]], 422)]
        for coordinates, expected in cases:
            with self.subTest(coordinates=coordinates), patch.object(main, "query_overpass_surface") as query:
                response, body = asyncio.run(post_surface({"type": "LineString", "coordinates": coordinates}))
                self.assertEqual(response["status"], expected)
                self.assertIn("detail", body)
                query.assert_not_called()

    def test_http_upstream_errors_and_success(self):
        payload = {"type": "LineString", "coordinates": [[24, 60]]}
        outcomes = [qos.OverpassTimeoutError(), qos.OverpassConnectionError(),
                    qos.OverpassBadResponseError("Invalid upstream data")]
        for error in outcomes:
            with self.subTest(error=error), patch.object(main, "query_overpass_surface", side_effect=error):
                response, body = asyncio.run(post_surface(payload))
                self.assertEqual(response["status"], error.status_code)
                self.assertEqual(body["detail"]["code"], error.code)
                self.assertIn((b"access-control-allow-origin", b"http://localhost:5173"), response["headers"])
        with patch.object(main, "query_overpass_surface", return_value={"asphalt": 100.0}):
            response, body = asyncio.run(post_surface(payload))
            self.assertEqual(response["status"], 200)
            self.assertEqual(body, {"asphalt": 100.0})

    def test_no_surface_tags_is_controlled(self):
        with self.assertRaises(qos.OverpassBadResponseError) as caught:
            qos._parse_surface_percentages({"elements": [{"tags": {}}]})
        self.assertEqual(caught.exception.code, "overpass_empty_surface")
