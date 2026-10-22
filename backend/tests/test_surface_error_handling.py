import unittest
from unittest.mock import patch

from fastapi import HTTPException
import requests

import main
import query_overpass_surface as qos


class FakeResponse:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.text = text

    @property
    def ok(self):
        return 200 <= self.status_code < 300

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


class QueryOverpassSurfaceTests(unittest.TestCase):
    def setUp(self):
        qos._CACHE.clear()

    @patch("query_overpass_surface.requests.post")
    def test_success_returns_percentages(self, mock_post):
        mock_post.return_value = FakeResponse(
            200,
            {
                "elements": [
                    {"tags": {"surface": "asphalt"}},
                    {"tags": {"surface": "asphalt"}},
                    {"tags": {"surface": "gravel"}},
                ]
            },
        )

        result = qos.query_overpass_surface(60.1699, 24.9384)

        self.assertEqual(result, {"asphalt": 66.7, "gravel": 33.3})
        self.assertEqual(mock_post.call_count, 1)

    @patch("query_overpass_surface.requests.post")
    def test_timeout_raises_typed_error(self, mock_post):
        mock_post.side_effect = requests.Timeout("timeout")

        with self.assertRaises(qos.OverpassTimeoutError) as ctx:
            qos.query_overpass_surface(60.1699, 24.9384)

        self.assertEqual(ctx.exception.status_code, 504)
        self.assertEqual(ctx.exception.code, "overpass_timeout")

    @patch("query_overpass_surface.requests.post")
    def test_connection_error_raises_typed_error(self, mock_post):
        mock_post.side_effect = requests.ConnectionError("connection failed")

        with self.assertRaises(qos.OverpassConnectionError) as ctx:
            qos.query_overpass_surface(60.1699, 24.9384)

        self.assertEqual(ctx.exception.status_code, 503)
        self.assertEqual(ctx.exception.code, "overpass_unavailable")

    @patch("query_overpass_surface.requests.post")
    def test_empty_data_raises_typed_error(self, mock_post):
        mock_post.return_value = FakeResponse(200, {"elements": []})

        with self.assertRaises(qos.OverpassBadResponseError) as ctx:
            qos.query_overpass_surface(60.1699, 24.9384)

        self.assertEqual(ctx.exception.status_code, 502)
        self.assertEqual(ctx.exception.code, "overpass_empty_data")

    @patch("query_overpass_surface.requests.post")
    def test_cache_hit_avoids_second_upstream_call(self, mock_post):
        mock_post.return_value = FakeResponse(
            200,
            {"elements": [{"tags": {"surface": "asphalt"}}]},
        )

        first = qos.query_overpass_surface(60.1699, 24.9384)
        second = qos.query_overpass_surface(60.1699, 24.9384)

        self.assertEqual(first, second)
        self.assertEqual(mock_post.call_count, 1)

    @patch("query_overpass_surface.requests.post")
    def test_cache_ttl_expiration_triggers_refetch(self, mock_post):
        mock_post.side_effect = [
            FakeResponse(200, {"elements": [{"tags": {"surface": "asphalt"}}]}),
            FakeResponse(200, {"elements": [{"tags": {"surface": "gravel"}}]}),
        ]

        with patch.object(qos, "CACHE_TTL_SECONDS", 1), patch("query_overpass_surface.time.monotonic", side_effect=[0.0, 2.0, 2.0]):
            first = qos.query_overpass_surface(60.1699, 24.9384)
            second = qos.query_overpass_surface(60.1699, 24.9384)

        self.assertEqual(first, {"asphalt": 100.0})
        self.assertEqual(second, {"gravel": 100.0})
        self.assertEqual(mock_post.call_count, 2)

    @patch("query_overpass_surface.requests.post")
    def test_406_retries_once_with_user_agent_and_can_succeed(self, mock_post):
        mock_post.side_effect = [
            FakeResponse(406, {"remark": "not acceptable"}),
            FakeResponse(200, {"elements": [{"tags": {"surface": "asphalt"}}]}),
        ]

        result = qos.query_overpass_surface(60.1699, 24.9384)

        self.assertEqual(result, {"asphalt": 100.0})
        self.assertEqual(mock_post.call_count, 2)
        _, first_kwargs = mock_post.call_args_list[0]
        _, second_kwargs = mock_post.call_args_list[1]
        self.assertIsNone(first_kwargs.get("headers"))
        self.assertEqual(second_kwargs.get("headers"), {"User-Agent": qos.OVERPASS_USER_AGENT})

    @patch("query_overpass_surface.requests.post")
    def test_406_then_406_returns_controlled_error(self, mock_post):
        mock_post.side_effect = [
            FakeResponse(406, {"remark": "not acceptable"}),
            FakeResponse(406, {"remark": "still not acceptable"}),
        ]

        with self.assertRaises(qos.OverpassBadResponseError) as ctx:
            qos.query_overpass_surface(60.1699, 24.9384)

        self.assertEqual(ctx.exception.status_code, 502)
        self.assertEqual(ctx.exception.code, "overpass_rejected")


class AnalyzeSurfaceApiTests(unittest.TestCase):
    def test_api_returns_504_on_timeout(self):
        payload = main.LineString(type="LineString", coordinates=[[24.9384, 60.1699], [24.9410, 60.1709]])
        with patch("main.query_overpass_surface", side_effect=qos.OverpassTimeoutError()):
            with self.assertRaises(HTTPException) as ctx:
                main.analyze_surface(payload)

        self.assertEqual(ctx.exception.status_code, 504)
        self.assertEqual(ctx.exception.detail["code"], "overpass_timeout")

    def test_api_returns_502_on_bad_response(self):
        payload = main.LineString(type="LineString", coordinates=[[24.9384, 60.1699], [24.9410, 60.1709]])
        with patch("main.query_overpass_surface", side_effect=qos.OverpassBadResponseError("bad upstream", code="overpass_bad_response")):
            with self.assertRaises(HTTPException) as ctx:
                main.analyze_surface(payload)

        self.assertEqual(ctx.exception.status_code, 502)
        self.assertEqual(ctx.exception.detail["code"], "overpass_bad_response")

    def test_api_returns_503_on_connection_error(self):
        payload = main.LineString(type="LineString", coordinates=[[24.9384, 60.1699], [24.9410, 60.1709]])
        with patch("main.query_overpass_surface", side_effect=qos.OverpassConnectionError()):
            with self.assertRaises(HTTPException) as ctx:
                main.analyze_surface(payload)

        self.assertEqual(ctx.exception.status_code, 503)
        self.assertEqual(ctx.exception.detail["code"], "overpass_unavailable")

    def test_api_returns_400_on_empty_coordinates(self):
        payload = main.LineString(type="LineString", coordinates=[])
        with self.assertRaises(HTTPException) as ctx:
            main.analyze_surface(payload)

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail["code"], "empty_coordinates")


if __name__ == "__main__":
    unittest.main()
