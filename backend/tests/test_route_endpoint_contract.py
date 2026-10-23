import asyncio
import json
import math
import unittest
from unittest.mock import patch

import main
from ors_route_service import ORSBadResponseError


def _build_scope(path: str):
    return {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": [
            (b"content-type", b"application/json"),
            (b"origin", b"http://localhost:5173"),
        ],
        "server": ("localhost", 8000),
        "client": ("127.0.0.1", 12345),
        "root_path": "",
    }


async def _post_json(path: str, payload):
    body = json.dumps(payload).encode()
    return await _post_raw(path, body)


async def _post_raw(path: str, body: bytes):
    messages = []

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(message):
        messages.append(message)

    await main.app(_build_scope(path), receive, send)
    start = next(m for m in messages if m["type"] == "http.response.start")
    content = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body")
    return start, json.loads(content)


class RouteEndpointContractTests(unittest.TestCase):
    def setUp(self):
        self.valid_request = {
            "start": [24.941, 60.1709],
            "end": [24.962, 60.2049],
            "profile": "cycling-regular",
        }

        self.valid_ors_payload = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[24.941, 60.1709], [24.962, 60.2049]],
                    },
                    "properties": {
                        "summary": {"distance": 1200.0, "duration": 420.0},
                        "extras": {
                            "surface": {
                                "summary": [
                                    {"value": 3, "distance": 1200.0, "amount": 100.0},
                                ],
                                "values": [[0, 1, 3]],
                            }
                        },
                    },
                }
            ],
        }

    def test_ok_response_contains_route_and_surface(self):
        with patch.object(main, "fetch_ors_route", return_value=self.valid_ors_payload):
            response, body = asyncio.run(_post_json("/api/v1/route", self.valid_request))

        self.assertEqual(response["status"], 200)
        self.assertEqual(body["status"], "ok")
        self.assertEqual(body["mode"], "live")
        self.assertIsNotNone(body["route"])
        self.assertIsNotNone(body["surface"])
        self.assertIsNone(body["error"])
        self.assertEqual(body["route"]["properties"]["distance_m"], 1200.0)
        self.assertEqual(body["surface"]["source"], "ors.extra_info.surface")

    def test_partial_response_when_surface_is_missing(self):
        payload = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[24.941, 60.1709], [24.962, 60.2049]],
                    },
                    "properties": {
                        "summary": {"distance": 1000.0, "duration": 300.0}
                    },
                }
            ],
        }

        with patch.object(main, "fetch_ors_route", return_value=payload):
            response, body = asyncio.run(_post_json("/api/v1/route", self.valid_request))

        self.assertEqual(response["status"], 200)
        self.assertEqual(body["status"], "partial")
        self.assertEqual(body["mode"], "live")
        self.assertIsNotNone(body["route"])
        self.assertIsNone(body["surface"])
        self.assertEqual(body["error"]["code"], "surface_unavailable")

    def test_partial_response_when_surface_has_non_finite_numbers(self):
        payload = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[24.941, 60.1709], [24.962, 60.2049]],
                    },
                    "properties": {
                        "summary": {"distance": 1000.0, "duration": 300.0},
                        "extras": {
                            "surface": {
                                "summary": [
                                    {"value": 1, "distance": 500.0, "amount": math.nan},
                                ],
                                "values": [[0, 1, 1]],
                            }
                        },
                    },
                }
            ],
        }

        with patch.object(main, "fetch_ors_route", return_value=payload):
            response, body = asyncio.run(_post_json("/api/v1/route", self.valid_request))

        self.assertEqual(response["status"], 200)
        self.assertEqual(body["status"], "partial")
        self.assertEqual(body["error"]["code"], "surface_invalid_data")

    def test_error_response_for_route_not_found(self):
        with patch.object(
            main,
            "fetch_ors_route",
            side_effect=ORSBadResponseError(
                "No route found between selected points",
                code="route_not_found",
                status_code=404,
            ),
        ):
            response, body = asyncio.run(_post_json("/api/v1/route", self.valid_request))

        self.assertEqual(response["status"], 404)
        self.assertEqual(body["status"], "error")
        self.assertEqual(body["mode"], "live")
        self.assertIsNone(body["route"])
        self.assertIsNone(body["surface"])
        self.assertEqual(body["error"]["code"], "route_not_found")

    def test_422_invalid_request_for_extra_fields(self):
        bad_request = {
            **self.valid_request,
            "sample": True,
        }

        response, body = asyncio.run(_post_json("/api/v1/route", bad_request))

        self.assertEqual(response["status"], 422)
        self.assertEqual(body["status"], "error")
        self.assertEqual(body["mode"], "live")
        self.assertEqual(body["error"]["code"], "invalid_request")

    def test_422_invalid_request_for_unsupported_profile(self):
        bad_request = {
            **self.valid_request,
            "profile": "driving-car",
        }

        response, body = asyncio.run(_post_json("/api/v1/route", bad_request))

        self.assertEqual(response["status"], 422)
        self.assertEqual(body["status"], "error")
        self.assertEqual(body["mode"], "live")
        self.assertEqual(body["error"]["code"], "invalid_request")

    def test_422_invalid_request_for_malformed_json(self):
        response, body = asyncio.run(_post_raw("/api/v1/route", b'{"start": [24.9, 60.1],'))

        self.assertEqual(response["status"], 422)
        self.assertEqual(body["status"], "error")
        self.assertEqual(body["mode"], "live")
        self.assertEqual(body["error"]["code"], "invalid_request")
        self.assertNotIn("details", body["error"])

    def test_422_invalid_request_rejects_non_numeric_coordinates_without_ors_call(self):
        bad_requests = [
            {**self.valid_request, "start": ["24.941", 60.1709]},
            {**self.valid_request, "start": [True, 60.1709]},
            {**self.valid_request, "start": [24.941, False]},
            {**self.valid_request, "start": [math.nan, 60.1709]},
            {**self.valid_request, "end": [24.962, float("inf")]},
        ]

        for payload in bad_requests:
            with self.subTest(payload=payload), patch.object(main, "fetch_ors_route") as fetch:
                response, body = asyncio.run(_post_json("/api/v1/route", payload))
                self.assertEqual(response["status"], 422)
                self.assertEqual(body["error"]["code"], "invalid_request")
                fetch.assert_not_called()

    def test_422_invalid_request_rejects_out_of_range_and_same_points_without_ors_call(self):
        bad_requests = [
            {**self.valid_request, "start": [181.0, 60.1709]},
            {**self.valid_request, "start": [24.941, -91.0]},
            {**self.valid_request, "start": [24.941, 60.1709], "end": [24.941, 60.1709]},
        ]

        for payload in bad_requests:
            with self.subTest(payload=payload), patch.object(main, "fetch_ors_route") as fetch:
                response, body = asyncio.run(_post_json("/api/v1/route", payload))
                self.assertEqual(response["status"], 422)
                self.assertEqual(body["error"]["code"], "invalid_request")
                fetch.assert_not_called()

    def test_500_internal_error_is_controlled(self):
        with patch.object(main, "fetch_ors_route", side_effect=RuntimeError("boom")):
            response, body = asyncio.run(_post_json("/api/v1/route", self.valid_request))

        self.assertEqual(response["status"], 500)
        self.assertEqual(body["status"], "error")
        self.assertEqual(body["mode"], "live")
        self.assertEqual(body["error"]["code"], "internal_error")


if __name__ == "__main__":
    unittest.main()
