"""Public routing decisions behind the stable Two-Gate Check Model."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from resolve_check_routing import resolve_routing  # noqa: E402


BASE_ENV = {
    "GITHUB_EVENT_NAME": "pull_request",
    "GITHUB_REF_TYPE": "branch",
    "GITHUB_REF_NAME": "feature",
    "PRODUCT_RUNTIME": "false",
    "DELIVERY_CONTROL": "false",
}
ROUTING_OUTPUTS = (
    "product_checks_required",
    "delivery_control_checks_required",
    "container_build_required",
)


ROUTING_CASES = (
    (
        "release tag",
        {
            "GITHUB_EVENT_NAME": "push",
            "GITHUB_REF_TYPE": "tag",
            "GITHUB_REF_NAME": "v0.6.0",
        },
        ("false", "false", "true"),
    ),
    (
        "product runtime",
        {"PRODUCT_RUNTIME": "true"},
        ("true", "false", "true"),
    ),
    (
        "delivery control",
        {"DELIVERY_CONTROL": "true"},
        ("false", "true", "false"),
    ),
    (
        "docs-only master push",
        {
            "GITHUB_EVENT_NAME": "push",
            "GITHUB_REF_TYPE": "branch",
            "GITHUB_REF_NAME": "master",
        },
        ("false", "false", "false"),
    ),
    (
        "manual workflow dispatch",
        {"GITHUB_EVENT_NAME": "workflow_dispatch"},
        ("true", "true", "true"),
    ),
)


def route(updates: dict[str, str]) -> dict[str, str]:
    env = dict(BASE_ENV)
    env.update(updates)
    return resolve_routing(env)


class ResolveCheckRoutingTest(unittest.TestCase):
    def test_routing_decision_table(self):
        for name, inputs, expected in ROUTING_CASES:
            with self.subTest(name=name):
                self.assertEqual(route(inputs), dict(zip(ROUTING_OUTPUTS, expected)))


if __name__ == "__main__":
    unittest.main()
