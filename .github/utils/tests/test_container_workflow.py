"""Static contracts for formal Paired Release Manifest publication."""

from __future__ import annotations

import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
WORKFLOW_PATH = REPO_ROOT / ".github" / "workflows" / "container.yml"


class ContainerWorkflowTest(unittest.TestCase):
    def test_release_asset_write_permission_is_isolated_to_tag_publication(self) -> None:
        workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
        build_job, publish_job = workflow.split("  publish-paired-release-manifest:", maxsplit=1)

        self.assertIn("contents: read", build_job)
        self.assertIn("packages: write", build_job)
        self.assertNotIn("contents: write", build_job)
        self.assertIn("github.ref_type == 'tag'", publish_job)
        self.assertIn("contents: write", publish_job)

    def test_paired_images_are_scanned_and_smoked_before_manifest(self) -> None:
        workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("apps/web/Dockerfile", workflow)
        self.assertIn("apps/api/Dockerfile", workflow)
        self.assertIn("Scan Web image", workflow)
        self.assertIn("Scan API image", workflow)
        self.assertIn("Paired runtime smoke", workflow)
        self.assertIn("paired_smoke.py", workflow)
        self.assertIn("http://localhost:18080/api/v1/rooms", workflow)
        self.assertIn(
            "redis@sha256:62b5498c91778f738f0efbf0a6fd5b434011235a3e7b5f2ed4a2c0c63bb1c786",
            workflow,
        )
        self.assertNotIn("redis:8.0.1-alpine", workflow)
        self.assertIn("--web-digest", workflow)
        self.assertIn("--api-digest", workflow)
        self.assertIn("-e HALLIGALLI_RELEASE_VERSION=runtime-override", workflow)
        self.assertIn("-e HALLIGALLI_RELEASE_COMMIT=runtime-override", workflow)

    def test_both_release_images_receive_provenance_before_pair_manifest(self) -> None:
        workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("attestations: write", workflow)
        self.assertIn("id-token: write", workflow)
        self.assertIn("Attest Web release image", workflow)
        self.assertIn("Attest API release image", workflow)
        self.assertIn("actions/attest-build-provenance@977bb373ede98d70efdf65b84cb5f73e068dcc2a", workflow)
        self.assertIn("subject-digest: ${{ steps.push.outputs.web_digest }}", workflow)
        self.assertIn("subject-digest: ${{ steps.push.outputs.api_digest }}", workflow)
        self.assertLess(
            workflow.index("Attest API release image"),
            workflow.index("Write paired release manifest"),
        )

    def test_release_asset_publication_never_clobbers_existing_evidence(self) -> None:
        workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("release_asset.py", workflow)
        self.assertIn("paired-release-manifest.json", workflow)
        self.assertIn("gh release upload", workflow)
        self.assertNotIn("--clobber", workflow)

if __name__ == "__main__":
    unittest.main()
