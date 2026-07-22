"""Public input/output contracts for release utilities."""

import unittest

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from release_utils import (  # noqa: E402
    append_github_outputs,
)
from paired_release_manifest import (  # noqa: E402
    PairedReleaseManifestError,
    build_paired_release_manifest,
)
from paired_smoke import PairedSmokeError, validate_paired_runtime  # noqa: E402


class ReleaseUtilsTest(unittest.TestCase):
    def test_formats_github_outputs_without_writing_when_path_absent(self):
        self.assertEqual(
            append_github_outputs({"version": "0.2.0", "commit_sha": "abc123"}, output_path=""),
            ["version=0.2.0", "commit_sha=abc123"],
        )

    def test_builds_a_schema_v2_paired_release_manifest(self):
        self.assertEqual(
            build_paired_release_manifest(
                tag="v1.2.3",
                commit="a" * 40,
                web_image="ghcr.io/example/halligalli-web:1.2.3",
                web_digest="sha256:" + "b" * 64,
                api_image="ghcr.io/example/halligalli-api:1.2.3",
                api_digest="sha256:" + "c" * 64,
            ),
            {
                "schemaVersion": 2,
                "releaseTag": "v1.2.3",
                "commit": "a" * 40,
                "images": {
                    "web": {
                        "repository": "ghcr.io/example/halligalli-web",
                        "tag": "1.2.3",
                        "digest": "sha256:" + "b" * 64,
                    },
                    "api": {
                        "repository": "ghcr.io/example/halligalli-api",
                        "tag": "1.2.3",
                        "digest": "sha256:" + "c" * 64,
                    },
                },
                "runtimeIdentity": {"version": "1.2.3", "commit": "a" * 40},
            },
        )

    def test_rejects_non_release_or_mutable_attestation_inputs(self):
        with self.assertRaisesRegex(PairedReleaseManifestError, "formal release tag"):
            build_paired_release_manifest(
                tag="pr-abcdef0",
                commit="a" * 40,
                web_image="ghcr.io/example/halligalli-web:pr-abcdef0",
                web_digest="sha256:" + "b" * 64,
                api_image="ghcr.io/example/halligalli-api:pr-abcdef0",
                api_digest="sha256:" + "c" * 64,
            )

    def test_rejects_partial_or_mixed_pair_attestation(self):
        with self.assertRaisesRegex(PairedReleaseManifestError, "both Web and API"):
            build_paired_release_manifest(
                tag="v1.2.3",
                commit="a" * 40,
                web_image="ghcr.io/example/halligalli-web:1.2.3",
                web_digest="sha256:" + "b" * 64,
                api_image="",
                api_digest="",
            )

    def test_rejects_mixed_image_versions(self):
        with self.assertRaisesRegex(PairedReleaseManifestError, "Image tags"):
            build_paired_release_manifest(
                tag="v1.2.3",
                commit="a" * 40,
                web_image="ghcr.io/example/halligalli-web:1.2.3",
                web_digest="sha256:" + "b" * 64,
                api_image="ghcr.io/example/halligalli-api:1.2.4",
                api_digest="sha256:" + "c" * 64,
            )

    def test_validates_a_paired_runtime_identity(self):
        validate_paired_runtime(
            web_identity={"version": "1.2.3", "commit": "a" * 40},
            api_identity={"version": "1.2.3", "commit": "a" * 40},
            version="1.2.3",
            commit="a" * 40,
        )
        with self.assertRaises(PairedSmokeError):
            validate_paired_runtime(
                web_identity={"version": "1.2.3", "commit": "a" * 40},
                api_identity={"version": "1.2.4", "commit": "a" * 40},
                version="1.2.3",
                commit="a" * 40,
            )

if __name__ == "__main__":
    unittest.main()
