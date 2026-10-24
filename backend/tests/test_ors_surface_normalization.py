import asyncio
import copy
import unittest
from unittest.mock import patch

import main
from ors_route_service import SurfaceDataError, extract_surface_payload
from test_route_endpoint_contract import _post_json


def route_fixture():
    return {
        "features": [{
            "geometry": {
                "type": "LineString",
                "coordinates": [[24.941, 60.1709], [24.9437, 60.1709],
                                [24.94532, 60.1709], [24.9464, 60.1709]],
            },
            "properties": {
                "summary": {"distance": 300.0, "duration": 90.0},
                "extras": {"surface": {
                    "summary": [
                        {"value": 3, "distance": 150.0, "amount": 50.0},
                        {"value": 10, "distance": 90.0, "amount": 30.0},
                        {"value": 0, "distance": 60.0, "amount": 20.0},
                    ],
                    "values": [[0, 1, 3], [1, 2, 10], [2, 3, 0]],
                }},
            },
        }],
    }


class SurfaceNormalizationTests(unittest.TestCase):
    def setUp(self):
        self.payload = route_fixture()
        self.properties = self.payload["features"][0]["properties"]
        self.surface = self.properties["extras"]["surface"]

    def assert_invalid(self):
        with self.assertRaises(SurfaceDataError) as caught:
            extract_surface_payload(self.payload)
        self.assertEqual(caught.exception.code, "surface_invalid_data")

    def test_public_format_shared_vertices_and_input_preservation(self):
        original = copy.deepcopy(self.payload)
        actual = extract_surface_payload(self.payload)
        self.assertEqual(actual, {
            "source": "ors.extra_info.surface",
            "summary": [
                {"surface_code": 3, "surface": "asphalt", "distance_m": 150.0, "percent": 50.0},
                {"surface_code": 10, "surface": "gravel", "distance_m": 90.0, "percent": 30.0},
                {"surface_code": 0, "surface": "unknown", "distance_m": 60.0, "percent": 20.0},
            ],
            "segments": [
                {"surface_code": 3, "surface": "asphalt", "index_start": 0, "index_end": 1},
                {"surface_code": 10, "surface": "gravel", "index_start": 1, "index_end": 2},
                {"surface_code": 0, "surface": "unknown", "index_start": 2, "index_end": 3},
            ],
        })
        self.assertEqual(self.payload, original)

    def test_unknown_codes_keep_separate_lengths_and_codes(self):
        self.surface["summary"][0]["value"] = 999
        self.surface["values"][0][2] = 999
        result = extract_surface_payload(self.payload)
        self.assertEqual(result["summary"][0], {
            "surface_code": 999, "surface": "unknown", "distance_m": 150.0, "percent": 50.0,
        })
        self.assertEqual(result["summary"][2]["surface_code"], 0)
        self.assertEqual(result["segments"][0]["surface"], "unknown")

    def test_summary_accepts_integer_valued_numeric_codes(self):
        for row in self.surface["summary"]:
            row["value"] = float(row["value"])
        result = extract_surface_payload(self.payload)
        self.assertEqual([row["surface_code"] for row in result["summary"]], [3, 10, 0])

    def test_all_unknown_is_valid(self):
        self.surface.update(summary=[{"value": 0, "distance": 300, "amount": 100}],
                            values=[[0, 3, 0]])
        result = extract_surface_payload(self.payload)
        self.assertEqual(result["summary"][0]["percent"], 100)
        self.assertEqual(result["segments"][0]["surface"], "unknown")

    def test_repeated_category_uses_one_total_without_segment_distances(self):
        self.surface.update(summary=[{"value": 3, "distance": 210, "amount": 70},
                                     {"value": 10, "distance": 90, "amount": 30}],
                            values=[[0, 1, 3], [1, 2, 10], [2, 3, 3]])
        result = extract_surface_payload(self.payload)
        self.assertEqual(len(result["summary"]), 2)
        self.assertEqual([s["surface_code"] for s in result["segments"]], [3, 10, 3])
        self.assertTrue(all("distance_m" not in s for s in result["segments"]))

    def test_missing_and_empty_data_are_unavailable(self):
        for surface in (None, {}, {"summary": []}, {"values": []},
                        {"summary": self.surface["summary"]},
                        {"summary": [], "values": self.surface["values"]}):
            with self.subTest(surface=surface):
                self.properties["extras"]["surface"] = surface
                with self.assertRaises(SurfaceDataError) as caught:
                    extract_surface_payload(self.payload)
                self.assertEqual(caught.exception.code, "surface_unavailable")

    def test_malformed_containers_are_invalid(self):
        for surface in ([], "bad", {"summary": "bad", "values": []},
                        {"summary": [], "values": {}}):
            with self.subTest(surface=surface):
                self.properties["extras"]["surface"] = surface
                self.assert_invalid()

    def test_invalid_segment_shapes_bounds_gaps_overlaps_and_codes(self):
        cases = [
            [[0, 0, 3], [0, 2, 10], [2, 3, 0]],
            [[0, 1, 3], [2, 3, 10]],
            [[0, 2, 3], [1, 2, 10], [2, 3, 0]],
            [[1, 2, 3], [2, 3, 10]],
            [[0, 1, 3], [1, 2, 10]],
            [[0, 1, 3], [1, 2, 10], [2, 4, 0]],
            [[-1, 1, 3]], [[0, 3, 3]], [[0, 3, 999]],
            [[0, 1, 3, 9]], [[False, 3, 3]], [[0, 3.0, 3]],
            [[0, 3, True]], [[2, 1, 3]], [None],
        ]
        for values in cases:
            with self.subTest(values=values):
                self.surface["values"] = values
                self.assert_invalid()

    def test_bad_summary_numbers_and_duplicate_codes(self):
        original = copy.deepcopy(self.surface["summary"])
        for field, value in [("value", True), ("value", 3.5), ("value", float("nan")),
                             ("distance", True),
                             ("distance", -1), ("distance", float("inf")),
                             ("distance", 10 ** 400), ("amount", float("nan")),
                             ("amount", "50"), ("amount", 101), ("amount", -1)]:
            with self.subTest(field=field, value=value):
                self.surface["summary"] = copy.deepcopy(original)
                self.surface["summary"][0][field] = value
                self.assert_invalid()
        self.surface["summary"] = original + [original[0]]
        self.assert_invalid()

    def test_distance_tolerance_boundaries_absolute_and_relative(self):
        for distance in (1000.0, 2000.0):
            for excess in (0, 0.00001):
                with self.subTest(distance=distance, excess=excess):
                    total = distance + max(1, .001 * distance) + excess
                    self.properties["summary"]["distance"] = distance
                    self.surface.update(summary=[{"value": 3, "distance": total, "amount": 100}],
                                        values=[[0, 3, 3]])
                    if excess:
                        self.assert_invalid()
                    else:
                        self.assertEqual(extract_surface_payload(self.payload)["summary"][0]["distance_m"], total)

    def test_percentage_total_tolerance_boundaries(self):
        for total in (99.97, 100.03, 99.96999, 100.03001):
            with self.subTest(total=total):
                self.surface["summary"][0]["amount"] = total - 50
                if 99.97 <= total <= 100.03:
                    extract_surface_payload(self.payload)
                else:
                    self.assert_invalid()

    def test_per_row_tolerance_boundaries(self):
        for delta in (-.15, .15, -.15001, .15001):
            with self.subTest(delta=delta):
                self.surface["summary"][0]["amount"] = 50 + delta
                self.surface["summary"][1]["amount"] = 30 - delta
                if abs(delta) <= .15:
                    extract_surface_payload(self.payload)
                else:
                    self.assert_invalid()

    def test_preserves_precision_without_renormalizing(self):
        for row in self.surface["summary"]:
            row.update(distance=100.0, amount=33.333333)
        result = extract_surface_payload(self.payload)
        self.assertEqual([row["percent"] for row in result["summary"]], [33.333333] * 3)

    def test_endpoint_preserves_route_on_surface_failure(self):
        request = {"start": [24.941, 60.1709], "end": [24.9464, 60.1709]}
        for values, code in (([], "surface_unavailable"),
                             ([[0, 3, 999]], "surface_invalid_data")):
            with self.subTest(code=code):
                self.surface["values"] = values
                with patch.object(main, "fetch_ors_route", return_value=self.payload):
                    response, body = asyncio.run(_post_json("/api/v1/route", request))
                self.assertEqual(response["status"], 200)
                self.assertEqual(body["status"], "partial")
                self.assertEqual(body["mode"], "live")
                self.assertIsNone(body["surface"])
                self.assertEqual(body["error"]["code"], code)
                self.assertEqual(body["route"]["geometry"], self.payload["features"][0]["geometry"])
                self.assertEqual(body["route"]["properties"], {
                    "distance_m": 300.0, "duration_s": 90.0, "source": "ors",
                })
