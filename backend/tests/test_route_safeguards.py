import asyncio
import logging
import os
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock, patch

import requests

import main
from ors_route_service import ORSBadResponseError
from route_guard import RouteGuard
from route_test_support import (
    TEST_API_KEY, VALID_ORS_PAYLOAD, FakeClock, RouteApiTestCase, header,
)
from test_ors_route_service import FakeResponse
from test_route_endpoint_contract import _post_json

REQUEST = {"start": [24.941, 60.1709], "end": [24.962, 60.2049]}
UNSAFE_LOG_FRAGMENTS = (TEST_API_KEY, "24.941", "60.1709", "24.962", "60.2049", "Authorization")


class RouteSafeguardTests(RouteApiTestCase):
    def post(self):
        return asyncio.run(_post_json("/api/v1/route", REQUEST))

    def post_rejected(self, code):
        with self.assertLogs("main", level="WARNING") as captured:
            result = self.post()
        output = "\n".join(captured.output)
        self.assertIn(code, output)
        for fragment in UNSAFE_LOG_FRAGMENTS:
            self.assertNotIn(fragment, output)
        return result

    def post_quiet(self):
        """Post a request that must be rejected without any WARNING-level log."""
        records = []

        class Collector(logging.Handler):
            def emit(self, record):
                records.append(record)

        handler = Collector(level=logging.WARNING)
        main_logger = logging.getLogger("main")
        main_logger.addHandler(handler)
        try:
            result = self.post()
        finally:
            main_logger.removeHandler(handler)
        self.assertEqual([r.getMessage() for r in records], [])
        return result

    def assert_rejection(self, result, status, code, retry_after=None):
        response, body = result
        self.assertEqual(response["status"], status)
        self.assertEqual(body["status"], "error")
        self.assertEqual(body["mode"], "live")
        self.assertIsNone(body["route"])
        self.assertIsNone(body["surface"])
        self.assertEqual(body["error"]["code"], code)
        self.assertEqual(header(response, "retry-after"), retry_after)

    def start_blocked_request(self):
        """Start a request that holds the slot inside the mocked ORS call."""
        entered, release = threading.Event(), threading.Event()
        result = {}

        def blocking_fetch(**kwargs):
            entered.set()
            if not release.wait(5):
                raise RuntimeError("test did not release the ORS call")
            return VALID_ORS_PAYLOAD

        patcher = patch.object(main, "fetch_ors_route", side_effect=blocking_fetch)
        fetch = patcher.start()
        self.addCleanup(patcher.stop)
        worker = threading.Thread(target=lambda: result.update(response=self.post()))
        self.addCleanup(worker.join, 5)
        self.addCleanup(release.set)
        worker.start()
        self.assertTrue(entered.wait(5))

        def finish():
            release.set()
            worker.join(5)
            self.assertFalse(worker.is_alive())
            return result["response"]

        return fetch, finish

    def test_disabled_by_default_and_only_exact_one_enables(self):
        for value in (None, "", "0", "true", "yes", " 1", "01"):
            with self.subTest(value=value), patch.dict(os.environ), \
                    patch.object(main, "fetch_ors_route") as fetch, \
                    patch("ors_route_service.requests.post") as http:
                if value is None:
                    os.environ.pop("ENABLE_ROUTE_API", None)
                else:
                    os.environ["ENABLE_ROUTE_API"] = value
                self.assert_rejection(self.post_quiet(), 503, "routes_disabled")
                fetch.assert_not_called()
                http.assert_not_called()

    def test_disabled_takes_precedence_over_missing_key(self):
        with patch.dict(os.environ), patch("ors_route_service.requests.post") as http:
            os.environ.pop("ENABLE_ROUTE_API")
            os.environ.pop("ORS_API_KEY")
            self.assert_rejection(self.post_quiet(), 503, "routes_disabled")
            http.assert_not_called()

    def test_enabled_without_key_is_503_and_makes_no_http_request(self):
        for value in (None, "", "   "):
            with self.subTest(value=value), patch.dict(os.environ), \
                    patch("ors_route_service.requests.post") as http:
                if value is None:
                    os.environ.pop("ORS_API_KEY", None)
                else:
                    os.environ["ORS_API_KEY"] = value
                self.assert_rejection(self.post_quiet(), 503, "ors_not_configured")
                http.assert_not_called()

    def test_busy_returns_429_immediately_without_second_ors_call(self):
        fetch, finish = self.start_blocked_request()

        busy = self.post_rejected("route_busy")

        self.assert_rejection(busy, 429, "route_busy", "1")
        self.assertEqual(fetch.call_count, 1)
        first_response, first_body = finish()
        self.assertEqual(first_response["status"], 200)
        self.assertEqual(first_body["status"], "ok")
        self.assertEqual(self.post()[0]["status"], 200)  # slot was released
        self.assertEqual(fetch.call_count, 2)

    def test_tenth_attempt_allowed_eleventh_limited_then_window_slides(self):
        with patch.object(main, "fetch_ors_route", return_value=VALID_ORS_PAYLOAD) as fetch:
            for i in range(10):
                self.clock.now = 1000.0 + i
                self.assertEqual(self.post()[0]["status"], 200)

            self.clock.now = 1010.0
            self.assert_rejection(
                self.post_rejected("route_rate_limited"), 429, "route_rate_limited", "50")
            self.assertEqual(fetch.call_count, 10)

            self.clock.now = 1059.5
            self.assert_rejection(
                self.post_rejected("route_rate_limited"), 429, "route_rate_limited", "1")
            self.assertEqual(fetch.call_count, 10)

            self.clock.now = 1060.0
            self.assertEqual(self.post()[0]["status"], 200)
            self.assertEqual(fetch.call_count, 11)

    def test_disabled_and_not_configured_do_not_consume_allowance(self):
        with patch.object(main, "fetch_ors_route", return_value=VALID_ORS_PAYLOAD) as fetch:
            for _ in range(3):
                with patch.dict(os.environ):
                    os.environ.pop("ENABLE_ROUTE_API")
                    self.assert_rejection(self.post_quiet(), 503, "routes_disabled")
                with patch.dict(os.environ, {"ORS_API_KEY": ""}):
                    self.assert_rejection(self.post_quiet(), 503, "ors_not_configured")
            fetch.assert_not_called()

            for _ in range(10):
                self.assertEqual(self.post()[0]["status"], 200)
            self.assert_rejection(
                self.post_rejected("route_rate_limited"), 429, "route_rate_limited", "60")
            self.assertEqual(fetch.call_count, 10)

    def test_busy_does_not_consume_allowance(self):
        fetch, finish = self.start_blocked_request()  # attempt 1
        for _ in range(3):
            self.assert_rejection(self.post_rejected("route_busy"), 429, "route_busy", "1")
        self.assertEqual(finish()[0]["status"], 200)

        for _ in range(9):  # attempts 2..10
            self.assertEqual(self.post()[0]["status"], 200)
        self.assert_rejection(
            self.post_rejected("route_rate_limited"), 429, "route_rate_limited", "60")
        self.assertEqual(fetch.call_count, 10)

    def test_slot_is_released_after_every_error_path(self):
        faults = [
            (patch.object(main, "fetch_ors_route", side_effect=ORSBadResponseError(
                "No route", code="route_not_found", status_code=404)), 404, "route_not_found"),
            (patch.object(main, "fetch_ors_route", side_effect=RuntimeError("boom")),
             500, "internal_error"),
            (patch("ors_route_service.requests.post", side_effect=requests.Timeout()),
             504, "ors_timeout"),
            (patch("ors_route_service.requests.post", side_effect=requests.ConnectionError()),
             503, "ors_unavailable"),
        ]
        for fault, status, code in faults:
            with self.subTest(code=code):
                with fault, self.assertLogs("main", level="WARNING") as captured:
                    response, body = self.post()
                self.assertEqual(response["status"], status)
                self.assertEqual(body["error"]["code"], code)
                for fragment in UNSAFE_LOG_FRAGMENTS:
                    self.assertNotIn(fragment, "\n".join(captured.output))
                with patch.object(main, "fetch_ors_route", return_value=VALID_ORS_PAYLOAD):
                    self.assertEqual(self.post()[0]["status"], 200)  # not route_busy
                self.clock.now += 61  # keep this test independent from the rate window

    def test_upstream_429_is_still_ors_rate_limited(self):
        with patch("ors_route_service.requests.post", return_value=FakeResponse(429)) as http:
            self.assert_rejection(self.post_rejected("ors_rate_limited"), 503, "ors_rate_limited")
            self.assert_rejection(self.post_rejected("ors_rate_limited"), 503, "ors_rate_limited")
        self.assertEqual(http.call_count, 2)

    def test_startup_logs_state_without_secrets(self):
        async def run_lifespan():
            async with main.lifespan(main.app):
                pass

        for value, expected in (("1", "route_api_enabled=true"), (None, "route_api_enabled=false"),
                                ("0", "route_api_enabled=false")):
            with self.subTest(value=value), patch.dict(os.environ):
                if value is None:
                    os.environ.pop("ENABLE_ROUTE_API")
                else:
                    os.environ["ENABLE_ROUTE_API"] = value
                with self.assertLogs("uvicorn.error", level="INFO") as captured:
                    asyncio.run(run_lifespan())
                output = "\n".join(captured.output)
                self.assertIn(expected, output)
                self.assertIn("ors_key_configured=true", output)
                self.assertNotIn(TEST_API_KEY, output)


class LegacySurfaceUnchangedTests(RouteApiTestCase):
    payload = {"type": "LineString", "coordinates": [[24, 60]]}

    def setUp(self):
        super().setUp()
        self.spy_guard = MagicMock(spec=RouteGuard)
        patcher = patch.object(main, "route_guard", self.spy_guard)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_analyze_surface_stays_disabled_when_route_api_is_enabled(self):
        os.environ.pop("ENABLE_LEGACY_SURFACE", None)
        with patch.object(main, "query_overpass_surface") as query:
            response, body = asyncio.run(_post_json("/analyze-surface", self.payload))
        self.assertEqual(response["status"], 404)
        self.assertEqual(body["detail"]["code"], "legacy_endpoint_disabled")
        query.assert_not_called()
        self.spy_guard.try_acquire.assert_not_called()

    def test_analyze_surface_does_not_depend_on_route_api_or_limiter(self):
        os.environ.pop("ENABLE_ROUTE_API")
        os.environ["ENABLE_LEGACY_SURFACE"] = "1"
        with patch.object(main, "query_overpass_surface", return_value={"asphalt": 100.0}):
            response, body = asyncio.run(_post_json("/analyze-surface", self.payload))
        self.assertEqual(response["status"], 200)
        self.assertEqual(body, {"asphalt": 100.0})
        self.spy_guard.try_acquire.assert_not_called()


class RouteGuardConcurrencyTests(unittest.TestCase):
    def test_only_one_of_many_simultaneous_callers_gets_the_slot(self):
        guard = RouteGuard(clock=FakeClock())
        workers = 16
        barrier = threading.Barrier(workers)

        def attempt(_):
            barrier.wait(5)
            return guard.try_acquire()

        with ThreadPoolExecutor(max_workers=workers) as pool:
            results = list(pool.map(attempt, range(workers)))

        self.assertEqual(sum(r is None for r in results), 1)
        self.assertTrue(all(r.code == "route_busy" for r in results if r is not None))
        guard.release()
        try:
            self.assertIsNone(guard.try_acquire())
        finally:
            guard.release()
