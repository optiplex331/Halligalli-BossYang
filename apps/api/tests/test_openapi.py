from __future__ import annotations

import json
import unittest
from pathlib import Path

from halligalli_api.app import create_app


class OpenApiSnapshotTest(unittest.TestCase):
    def test_committed_openapi_matches_pydantic_transport_models(self) -> None:
        snapshot_path = Path(__file__).parents[3] / "contracts" / "openapi.json"
        expected = json.loads(snapshot_path.read_text(encoding="utf-8"))

        self.assertEqual(expected, create_app().openapi())
