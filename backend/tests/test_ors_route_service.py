import os
import math
import unittest
from unittest.mock import patch
import requests

from ors_route_service import ORSBadResponseError, ORSConfigError, ORSError, extract_route_payload, fetch_ors_route


class FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}

    @property
    def ok(self):
        return 200 <= self.status_code < 300

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


class ORSRouteServiceTests(unittest.TestCase):
    def setUp(self):
        self.old_key = os.environ.get("ORS_API_KEY")
        os.environ["ORS_API_KEY"] = "test-key"

    def tearDown(self):
        if self.old_key is None:
            os.environ.pop("ORS_API_KEY", None)
        else:
            os.environ["ORS_API_KEY"] = self.old_key

    @patch("ors_route_service.requests.post")
    def test_2009_maps_to_route_not_found(self, mock_post):
        mock_post.return_value = FakeResponse(404, {"error": {"code": 2009, "message": "No route"}})

        with self.assertRaises(ORSBadResponseError) as ctx:
            fetch_ors_route(start=(24.9, 60.1), end=(24.91, 60.11), profile="cycling-regular")

        self.assertEqual(ctx.exception.code, "route_not_found")
        self.assertEqual(ctx.exception.status_code, 404)

    @patch("ors_route_service.requests.post")
    def test_2010_maps_to_waypoint_not_found(self, mock_post):
        mock_post.return_value = FakeResponse(400, {"error": {"code": 2010, "message": "Point not found"}})

        with self.assertRaises(ORSBadResponseError) as ctx:
            fetch_ors_route(start=(24.9, 60.1), end=(24.91, 60.11), profile="cycling-regular")

        self.assertEqual(ctx.exception.code, "waypoint_not_found")
        self.assertEqual(ctx.exception.status_code, 422)

    @patch("ors_route_service.requests.post")
    def test_http_status_alone_does_not_map_to_route_not_found(self, mock_post):
        mock_post.return_value = FakeResponse(404, {"error": {"message": "generic"}})

        with self.assertRaises(ORSBadResponseError) as ctx:
            fetch_ors_route(start=(24.9, 60.1), end=(24.91, 60.11), profile="cycling-regular")

        self.assertEqual(ctx.exception.code, "ors_rejected")

    def test_missing_api_key_is_controlled(self):
        os.environ.pop("ORS_API_KEY", None)

        with self.assertRaises(ORSConfigError) as ctx:
            fetch_ors_route(start=(24.9, 60.1), end=(24.91, 60.11), profile="cycling-regular")

        self.assertEqual(ctx.exception.code, "ors_not_configured")
        self.assertEqual(ctx.exception.status_code, 503)

    @patch("ors_route_service.requests.post")
    def test_401_and_403_map_to_access_denied(self, mock_post):
        for status in (401, 403):
            with self.subTest(status=status):
                mock_post.return_value = FakeResponse(status, {"error": {"message": "denied"}})
                with self.assertRaises(ORSBadResponseError) as ctx:
                    fetch_ors_route(start=(24.9, 60.1), end=(24.91, 60.11), profile="cycling-regular")
                self.assertEqual(ctx.exception.code, "ors_auth_failed")
                self.assertEqual(ctx.exception.status_code, 502)

    @patch("ors_route_service.requests.post")
    def test_429_maps_to_rate_limited(self, mock_post):
        mock_post.return_value = FakeResponse(429, {"error": {"message": "too many"}})
        with self.assertRaises(ORSBadResponseError) as ctx:
            fetch_ors_route(start=(24.9, 60.1), end=(24.91, 60.11), profile="cycling-regular")

        self.assertEqual(ctx.exception.code, "ors_rate_limited")
        self.assertEqual(ctx.exception.status_code, 503)

    @patch("ors_route_service.requests.post")
    def test_408_and_504_map_to_timeout(self, mock_post):
        for status in (408, 504):
            with self.subTest(status=status):
                mock_post.return_value = FakeResponse(status, {"error": {"message": "timeout"}})
                with self.assertRaises(ORSBadResponseError) as ctx:
                    fetch_ors_route(start=(24.9, 60.1), end=(24.91, 60.11), profile="cycling-regular")
                self.assertEqual(ctx.exception.code, "ors_timeout")
                self.assertEqual(ctx.exception.status_code, 504)

    @patch("ors_route_service.requests.post")
    def test_5xx_maps_to_unavailable(self, mock_post):
        for status in (500, 502, 503):
            with self.subTest(status=status):
                mock_post.return_value = FakeResponse(status, {"error": {"message": "upstream"}})
                with self.assertRaises(ORSBadResponseError) as ctx:
                    fetch_ors_route(start=(24.9, 60.1), end=(24.91, 60.11), profile="cycling-regular")
                self.assertEqual(ctx.exception.code, "ors_unavailable")
                self.assertEqual(ctx.exception.status_code, 503)

    @patch("ors_route_service.requests.post")
    def test_requests_timeout_exception_maps_to_timeout(self, mock_post):
        mock_post.side_effect = requests.Timeout("timed out")
        with self.assertRaises(ORSError) as ctx:
            fetch_ors_route(start=(24.9, 60.1), end=(24.91, 60.11), profile="cycling-regular")

        self.assertEqual(ctx.exception.code, "ors_timeout")
        self.assertEqual(ctx.exception.status_code, 504)

    @patch("ors_route_service.requests.post")
    def test_requests_connection_exception_maps_to_unavailable(self, mock_post):
        mock_post.side_effect = requests.ConnectionError("connection")
        with self.assertRaises(ORSError) as ctx:
            fetch_ors_route(start=(24.9, 60.1), end=(24.91, 60.11), profile="cycling-regular")

        self.assertEqual(ctx.exception.code, "ors_unavailable")
        self.assertEqual(ctx.exception.status_code, 503)

    @patch("ors_route_service.requests.post")
    def test_non_json_success_response_maps_to_invalid_response(self, mock_post):
        mock_post.return_value = FakeResponse(200, ValueError("not json"))
        with self.assertRaises(ORSBadResponseError) as ctx:
            fetch_ors_route(start=(24.9, 60.1), end=(24.91, 60.11), profile="cycling-regular")

        self.assertEqual(ctx.exception.code, "ors_invalid_response")
        self.assertEqual(ctx.exception.status_code, 502)


class ORSRoutePayloadValidationTests(unittest.TestCase):
    def _payload(self, *, coordinates=None, distance=1000.0, duration=300.0):
        return {
            "features": [
                {
                    "geometry": {
                        "type": "LineString",
                        "coordinates": coordinates if coordinates is not None else [[24.9, 60.1], [24.91, 60.11]],
                    },
                    "properties": {
                        "summary": {
                            "distance": distance,
                            "duration": duration,
                        }
                    },
                }
            ]
        }

    def test_rejects_empty_geometry(self):
        with self.assertRaises(ORSBadResponseError) as ctx:
            extract_route_payload(self._payload(coordinates=[]))
        self.assertEqual(ctx.exception.code, "ors_invalid_response")

    def test_rejects_negative_distance(self):
        with self.assertRaises(ORSBadResponseError) as ctx:
            extract_route_payload(self._payload(distance=-1.0))
        self.assertEqual(ctx.exception.code, "ors_invalid_response")

    def test_rejects_zero_distance(self):
        with self.assertRaises(ORSBadResponseError) as ctx:
            extract_route_payload(self._payload(distance=0.0))
        self.assertEqual(ctx.exception.code, "ors_invalid_response")

    def test_rejects_boolean_distance(self):
        with self.assertRaises(ORSBadResponseError) as ctx:
            extract_route_payload(self._payload(distance=True))
        self.assertEqual(ctx.exception.code, "ors_invalid_response")

    def test_rejects_out_of_range_coordinates(self):
        with self.assertRaises(ORSBadResponseError) as ctx:
            extract_route_payload(self._payload(coordinates=[[999.0, 999.0], [24.91, 60.11]]))
        self.assertEqual(ctx.exception.code, "ors_invalid_response")

    def test_rejects_non_finite_metrics(self):
        with self.assertRaises(ORSBadResponseError) as ctx:
            extract_route_payload(self._payload(distance=math.nan))
        self.assertEqual(ctx.exception.code, "ors_invalid_response")


if __name__ == "__main__":
    unittest.main()
