"""Tests for provider-neutral release utility helpers."""

import json
import unittest

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from release_utils import (  # noqa: E402
    ReleaseUtilityError,
    append_github_outputs,
    check_health_release_identity,
)


class ReleaseUtilsTest(unittest.TestCase):
    def test_accepts_matching_health_response(self):
        health = check_health_release_identity(
            json.dumps({"status": "ok", "version": "0.2.0", "commit": "abc123"}),
            {"appVersion": "0.2.0", "commitSha": "abc123"},
        )

        self.assertEqual(health["status"], "ok")

    def test_rejects_mismatched_health_response(self):
        with self.assertRaisesRegex(ReleaseUtilityError, "Release identity mismatch"):
            check_health_release_identity(
                json.dumps({"status": "ok", "version": "0.3.0", "commit": "abc123"}),
                {"appVersion": "0.2.0", "commitSha": "abc123"},
            )

    def test_formats_github_outputs_without_writing_when_path_absent(self):
        self.assertEqual(
            append_github_outputs({"version": "0.2.0", "commit_sha": "abc123"}, output_path=""),
            ["version=0.2.0", "commit_sha=abc123"],
        )


if __name__ == "__main__":
    unittest.main()
