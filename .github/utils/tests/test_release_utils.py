"""Test shared release utility helper behavior.

Purpose:
- Protect health identity validation and GitHub step-output formatting.
Fixtures:
- In-memory JSON payloads, expected identity dictionaries, and output mappings.
Coverage:
- Accept matching /health identity.
- Reject mismatched release identity.
- Format GitHub outputs without writing when no output path is provided.
Boundaries:
- Does not read workflow files, call GitHub Actions, or require pnpm install.
"""

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
from release_attestation import (  # noqa: E402
    ReleaseAttestationError,
    build_release_attestation,
)
from release_asset import ReleaseAssetError, assess_release_asset  # noqa: E402


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

    def test_builds_a_formal_release_attestation(self):
        self.assertEqual(
            build_release_attestation(
                tag="v1.2.3",
                commit="a" * 40,
                image="ghcr.io/example/halligalli:1.2.3",
                digest="sha256:" + "b" * 64,
            ),
            {
                "schemaVersion": 1,
                "releaseTag": "v1.2.3",
                "commit": "a" * 40,
                "image": {
                    "repository": "ghcr.io/example/halligalli",
                    "tag": "1.2.3",
                    "digest": "sha256:" + "b" * 64,
                },
                "runtimeIdentity": {"version": "1.2.3", "commit": "a" * 40},
            },
        )

    def test_rejects_non_release_or_mutable_attestation_inputs(self):
        with self.assertRaisesRegex(ReleaseAttestationError, "formal release tag"):
            build_release_attestation(
                tag="pr-abcdef0",
                commit="a" * 40,
                image="ghcr.io/example/halligalli:pr-abcdef0",
                digest="sha256:" + "b" * 64,
            )

    def test_uploads_a_new_release_asset(self):
        assessment = assess_release_asset(b'{"releaseTag":"v1.2.3"}\n', None)

        self.assertEqual(assessment["action"], "upload")
        self.assertRegex(assessment["sha256"], r"^[0-9a-f]{64}$")

    def test_reuses_an_identical_release_asset(self):
        contents = b'{"releaseTag":"v1.2.3"}\n'

        self.assertEqual(assess_release_asset(contents, contents)["action"], "reuse")

    def test_rejects_overwriting_a_different_release_asset(self):
        with self.assertRaisesRegex(ReleaseAssetError, "already exists with different contents"):
            assess_release_asset(
                b'{"releaseTag":"v1.2.3"}\n',
                b'{"releaseTag":"v1.2.2"}\n',
            )


if __name__ == "__main__":
    unittest.main()
