"""Tests for Production Manifest parsing, updates, drift, and health checks."""

import json
import tempfile
import unittest
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from production_manifest import (  # noqa: E402
    ManifestError,
    check_health_release_identity,
    compare_production_manifest_to_live_spec,
    read_production_manifest,
    read_release_identity,
    write_release_identity,
)


MANIFEST = """name: halligalli
region: ams
services:
- name: web
  image:
    registry_type: GHCR
    registry: optiplex331
    repository: halligalli-bossyang
    digest: sha256:old
  instance_count: 1
  envs:
  - key: NODE_ENV
    value: production
  - key: APP_VERSION
    value: 0.2.0
  - key: COMMIT_SHA
    value: abc123
"""


def temp_manifest():
    """Create an editable manifest fixture while preserving test isolation."""

    temp_dir = tempfile.TemporaryDirectory()
    file_path = Path(temp_dir.name) / "app.yaml"
    file_path.write_text(MANIFEST, encoding="utf-8")
    return temp_dir, file_path


class ProductionManifestTest(unittest.TestCase):
    def test_reads_release_identity_from_production_manifest(self):
        self.assertEqual(
            read_production_manifest(MANIFEST)["identity"],
            {
                "imageDigest": "sha256:old",
                "appVersion": "0.2.0",
                "commitSha": "abc123",
            },
        )

    def test_updates_only_release_identity_fields(self):
        temp_dir, file_path = temp_manifest()
        self.addCleanup(temp_dir.cleanup)

        write_release_identity(
            file_path,
            {
                "imageDigest": "sha256:new",
                "appVersion": "0.3.0",
                "commitSha": "def456",
            },
        )

        updated = file_path.read_text(encoding="utf-8")
        identity = read_release_identity(file_path)
        self.assertEqual(identity["imageDigest"], "sha256:new")
        self.assertEqual(identity["appVersion"], "0.3.0")
        self.assertEqual(identity["commitSha"], "def456")
        self.assertIn("registry: optiplex331", updated)
        self.assertIn("repository: halligalli-bossyang", updated)
        self.assertIn("value: production", updated)

    def test_reports_no_drift_when_live_spec_matches(self):
        live_spec = {
            "services": [
                {
                    "name": "web",
                    "image": {
                        "registry_type": "GHCR",
                        "registry": "optiplex331",
                        "repository": "halligalli-bossyang",
                        "digest": "sha256:old",
                    },
                    "envs": [
                        {"key": "APP_VERSION", "value": "0.2.0"},
                        {"key": "COMMIT_SHA", "value": "abc123"},
                    ],
                }
            ]
        }

        self.assertEqual(
            compare_production_manifest_to_live_spec(MANIFEST, live_spec)["drift"],
            [],
        )

    def test_reports_drift_when_live_release_identity_differs(self):
        live_spec = {
            "services": [
                {
                    "name": "web",
                    "image": {
                        "registry_type": "GHCR",
                        "registry": "optiplex331",
                        "repository": "halligalli-bossyang",
                        "digest": "sha256:different",
                    },
                    "envs": [
                        {"key": "APP_VERSION", "value": "0.2.0"},
                        {"key": "COMMIT_SHA", "value": "zzz999"},
                    ],
                }
            ]
        }

        self.assertEqual(
            compare_production_manifest_to_live_spec(MANIFEST, live_spec)["drift"],
            [
                'image.digest: expected "sha256:old", got "sha256:different"',
                'COMMIT_SHA: expected "abc123", got "zzz999"',
            ],
        )

    def test_accepts_matching_health_response(self):
        health = check_health_release_identity(
            json.dumps({"status": "ok", "version": "0.2.0", "commit": "abc123"}),
            {"appVersion": "0.2.0", "commitSha": "abc123"},
        )

        self.assertEqual(health["status"], "ok")

    def test_rejects_mismatched_health_response(self):
        with self.assertRaisesRegex(ManifestError, "Release identity mismatch"):
            check_health_release_identity(
                json.dumps({"status": "ok", "version": "0.3.0", "commit": "abc123"}),
                {"appVersion": "0.2.0", "commitSha": "abc123"},
            )


if __name__ == "__main__":
    unittest.main()
