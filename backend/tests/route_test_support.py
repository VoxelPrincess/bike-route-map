import os
import unittest
from unittest.mock import patch

import main
from route_guard import RouteGuard

TEST_API_KEY = "secret-test-key-do-not-log"

VALID_ORS_PAYLOAD = {
    "type": "FeatureCollection",
    "features": [{
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": [[24.941, 60.1709], [24.962, 60.2049]],
        },
        "properties": {
            "summary": {"distance": 1200.0, "duration": 420.0},
            "extras": {"surface": {
                "summary": [{"value": 3, "distance": 1200.0, "amount": 100.0}],
                "values": [[0, 1, 3]],
            }},
        },
    }],
}


class FakeClock:
    def __init__(self, now: float = 1000.0):
        self.now = now

    def __call__(self) -> float:
        return self.now


def header(response, name):
    wanted = name.lower().encode()
    return next((v.decode() for k, v in response["headers"] if k.lower() == wanted), None)


class RouteApiTestCase(unittest.TestCase):
    """Enables the route API with a fake key and isolates limiter state per test."""

    def setUp(self):
        super().setUp()
        env = patch.dict(os.environ, {"ENABLE_ROUTE_API": "1", "ORS_API_KEY": TEST_API_KEY})
        env.start()
        self.addCleanup(env.stop)

        self.clock = FakeClock()
        self.guard = RouteGuard(clock=self.clock)
        guard_patch = patch.object(main, "route_guard", self.guard)
        guard_patch.start()
        self.addCleanup(guard_patch.stop)
