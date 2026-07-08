"""Test Two-Gate CI routing decisions.

Purpose:
- Protect required-check routing for CI and Container workflows.
Fixtures:
- Fake GitHub event/ref values and fake dorny/paths-filter output variables.
Coverage:
- Release tags require container builds.
- Product runtime changes require product checks and container builds.
- Delivery-control, release-metadata, docs-only, and manual-dispatch paths route
  to the expected work.
Boundaries:
- Does not invoke GitHub Actions or inspect real changed files.
"""

import unittest

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from resolve_check_routing import resolve_routing  # noqa: E402


BASE_ENV = {
    "GITHUB_EVENT_NAME": "pull_request",
    "GITHUB_REF_TYPE": "branch",
    "GITHUB_REF_NAME": "feature",
    "PRODUCT_RUNTIME": "false",
    "DELIVERY_CONTROL": "false",
    "RELEASE_METADATA": "false",
}


def route(**updates: str) -> dict[str, str]:
    env = dict(BASE_ENV)
    env.update(updates)
    return resolve_routing(env)


class ResolveCheckRoutingTest(unittest.TestCase):
    def test_release_tag_requires_container_build(self):
        outputs = route(
            GITHUB_EVENT_NAME="push",
            GITHUB_REF_TYPE="tag",
            GITHUB_REF_NAME="v0.6.0",
        )

        self.assertEqual(outputs["classification"], "release-tag")
        self.assertEqual(outputs["container_build_required"], "true")

    def test_product_runtime_requires_product_checks_and_container_build(self):
        outputs = route(PRODUCT_RUNTIME="true")

        self.assertEqual(outputs["classification"], "product-runtime")
        self.assertEqual(outputs["product_checks_required"], "true")
        self.assertEqual(outputs["container_build_required"], "true")

    def test_delivery_control_skips_container_build(self):
        outputs = route(DELIVERY_CONTROL="true")

        self.assertEqual(outputs["classification"], "delivery-control")
        self.assertEqual(outputs["delivery_control_checks_required"], "true")
        self.assertEqual(outputs["container_build_required"], "false")

    def test_release_metadata_skips_container_build(self):
        outputs = route(RELEASE_METADATA="true")

        self.assertEqual(outputs["classification"], "release-metadata")
        self.assertEqual(outputs["container_build_required"], "false")

    def test_docs_only_master_push_does_not_publish_development_image(self):
        outputs = route(
            GITHUB_EVENT_NAME="push",
            GITHUB_REF_TYPE="branch",
            GITHUB_REF_NAME="master",
        )

        self.assertEqual(outputs["classification"], "metadata-or-docs")
        self.assertEqual(outputs["container_build_required"], "false")

    def test_workflow_dispatch_runs_all_checks(self):
        outputs = route(GITHUB_EVENT_NAME="workflow_dispatch")

        self.assertEqual(outputs["classification"], "workflow-dispatch")
        self.assertEqual(outputs["product_checks_required"], "true")
        self.assertEqual(outputs["delivery_control_checks_required"], "true")
        self.assertEqual(outputs["container_build_required"], "true")


if __name__ == "__main__":
    unittest.main()
