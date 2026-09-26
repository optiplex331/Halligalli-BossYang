"""Public image identity and push-policy decisions."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from resolve_image_identity import (  # noqa: E402
    ImageIdentityError,
    resolve_identity,
)

BASE_ENV = {
    "GITHUB_REPOSITORY": "owner/repo",
    "GITHUB_REF_TYPE": "branch",
    "GITHUB_REF_NAME": "feature",
    "GITHUB_EVENT_NAME": "pull_request",
    "GITHUB_SHA": "abc1234def5678",
}

IMAGE_IDENTITY_CASES = (
    {
        "name": "release tag publishes canonical release image",
        "env": {
            "GITHUB_REPOSITORY": "Optiplex331/Halligalli-Bossyang",
            "GITHUB_REF_TYPE": "tag",
            "GITHUB_REF_NAME": "v0.3.0",
            "GITHUB_EVENT_NAME": "push",
        },
        "expected": {
            "repository": "Optiplex331/Halligalli-Bossyang",
            "version": "0.3.0",
            "should_push_image": "true",
        },
    },
    {
        "name": "pull request gets a stable non-publishing image",
        "env": {},
        "expected": {
            "repository": "owner/repo",
            "version": "pr-abc1234",
            "should_push_image": "false",
        },
    },
    {
        "name": "manual workflow dispatch on master stays non-publishing",
        "env": {"GITHUB_EVENT_NAME": "workflow_dispatch", "GITHUB_REF_NAME": "master"},
        "expected": {
            "repository": "owner/repo",
            "version": "pr-abc1234",
            "should_push_image": "false",
        },
    },
    {
        "name": "non-semver release tag is rejected",
        "env": {"GITHUB_REF_TYPE": "tag", "GITHUB_REF_NAME": "v1.2.3-rc"},
        "error": "vX.Y.Z",
    },
    {
        "name": "missing commit SHA is rejected",
        "env": {"GITHUB_SHA": ""},
        "error": "GITHUB_SHA",
    },
)


def identity_env(updates: dict[str, str]) -> dict[str, str]:
    env = dict(BASE_ENV)
    env.update(updates)
    return env


def expected_identity(expected: dict[str, str]) -> dict[str, str]:
    image = f"ghcr.io/{expected['repository']}".lower()
    return {
        "version": expected["version"],
        "web_image": f"{image}-web",
        "api_image": f"{image}-api",
        "web_image_tag": f"{image}-web:{expected['version']}",
        "api_image_tag": f"{image}-api:{expected['version']}",
        "commit_sha": BASE_ENV["GITHUB_SHA"],
        "should_push_image": expected["should_push_image"],
    }


class ResolveImageIdentityTest(unittest.TestCase):
    def test_identity_decision_table(self):
        for case in IMAGE_IDENTITY_CASES:
            with self.subTest(name=case["name"]):
                env = identity_env(case["env"])
                if "error" in case:
                    with self.assertRaisesRegex(ImageIdentityError, case["error"]):
                        resolve_identity(env)
                else:
                    self.assertEqual(
                        resolve_identity(env), expected_identity(case["expected"])
                    )


if __name__ == "__main__":
    unittest.main()
