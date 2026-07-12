"""Static contracts for formal Release Attestation publication."""

from __future__ import annotations

import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
WORKFLOW_PATH = REPO_ROOT / ".github" / "workflows" / "container.yml"


class ContainerWorkflowTest(unittest.TestCase):
    def test_release_asset_write_permission_is_isolated_to_tag_publication(self) -> None:
        workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
        build_job, publish_job = workflow.split("  publish-release-attestation:", maxsplit=1)

        self.assertIn("contents: read", build_job)
        self.assertIn("packages: write", build_job)
        self.assertNotIn("contents: write", build_job)
        self.assertIn("github.ref_type == 'tag'", publish_job)
        self.assertIn("contents: write", publish_job)

    def test_paired_images_are_scanned_and_smoked_before_attestation(self) -> None:
        workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("apps/web/Dockerfile", workflow)
        self.assertIn("apps/api/Dockerfile", workflow)
        self.assertIn("Scan Web image", workflow)
        self.assertIn("Scan API image", workflow)
        self.assertIn("Paired runtime smoke", workflow)
        self.assertIn("paired_smoke.py", workflow)
        self.assertIn("--web-digest", workflow)
        self.assertIn("--api-digest", workflow)

    def test_release_asset_publication_never_clobbers_existing_evidence(self) -> None:
        workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

        self.assertIn("release_asset.py", workflow)
        self.assertIn("gh release upload", workflow)
        self.assertNotIn("--clobber", workflow)


if __name__ == "__main__":
    unittest.main()
