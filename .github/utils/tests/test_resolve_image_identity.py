"""Public image identity and push-policy decisions."""

import sys
import unittest
from collections.abc import Sequence
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from resolve_image_identity import (  # noqa: E402
    ImageIdentityError,
    resolve_identity,
)


def fake_git(outputs: dict[tuple[str, ...], str]):
    """Provide deterministic git command results to the resolver under test."""

    def run(args: Sequence[str], allow_failure: bool = False) -> str:
        key = tuple(args)
        if key in outputs:
            return outputs[key]
        if allow_failure:
            return ""
        raise ImageIdentityError(f"missing fake git output for {key}")

    return run


BASE_ENV = {
    "GITHUB_REPOSITORY": "owner/repo",
    "GITHUB_REF_TYPE": "branch",
    "GITHUB_REF_NAME": "feature",
    "GITHUB_EVENT_NAME": "pull_request",
    "GITHUB_SHA": "abc1234def5678",
}
GIT_HEAD = ("rev-parse", "HEAD")
GIT_EXACT_RELEASE = (
    "describe",
    "--tags",
    "--exact-match",
    "--match",
    "v[0-9]*.[0-9]*.[0-9]*",
    "HEAD",
)
GIT_DEVELOPMENT_VERSION = (
    "describe",
    "--tags",
    "--first-parent",
    "--long",
    "--abbrev=7",
    "--match",
    "v[0-9]*.[0-9]*.[0-9]*",
)


IMAGE_IDENTITY_CASES = (
    {
        "name": "release tag publishes canonical release image",
        "env": {
            "GITHUB_REPOSITORY": "Optiplex331/Halligalli-Bossyang",
            "GITHUB_REF_TYPE": "tag",
            "GITHUB_REF_NAME": "v0.3.0",
            "GITHUB_EVENT_NAME": "push",
        },
        "git": {GIT_HEAD: "abc1234def5678"},
        "expected": {
            "repository": "Optiplex331/Halligalli-Bossyang",
            "version": "0.3.0",
            "commit": "abc1234def5678",
            "should_push_image": "true",
        },
    },
    {
        "name": "master push publishes development image",
        "env": {"GITHUB_REF_NAME": "master", "GITHUB_EVENT_NAME": "push"},
        "git": {
            GIT_HEAD: "c08fdcaf00d1234",
            GIT_DEVELOPMENT_VERSION: "v0.2.0-48-gc08fdca",
        },
        "expected": {
            "repository": "owner/repo",
            "version": "0.2.0-0048-gc08fdca",
            "commit": "c08fdcaf00d1234",
            "should_push_image": "true",
        },
    },
    {
        "name": "master push at exact release tag stays non-publishing",
        "env": {"GITHUB_REF_NAME": "master", "GITHUB_EVENT_NAME": "push"},
        "git": {GIT_HEAD: "abc1234def5678", GIT_EXACT_RELEASE: "v0.3.0"},
        "expected": {
            "repository": "owner/repo",
            "version": "0.3.0",
            "commit": "abc1234def5678",
            "should_push_image": "false",
        },
    },
    {
        "name": "pull request gets a stable non-publishing image",
        "env": {},
        "git": {GIT_HEAD: "abc1234def5678"},
        "expected": {
            "repository": "owner/repo",
            "version": "pr-abc1234",
            "commit": "abc1234def5678",
            "should_push_image": "false",
        },
    },
    {
        "name": "manual workflow dispatch gets a stable non-publishing image",
        "env": {"GITHUB_EVENT_NAME": "workflow_dispatch", "GITHUB_REF_NAME": "master"},
        "git": {GIT_HEAD: "abc1234def5678"},
        "expected": {
            "repository": "owner/repo",
            "version": "pr-abc1234",
            "commit": "abc1234def5678",
            "should_push_image": "false",
        },
    },
    {
        "name": "non-semver release tag is rejected",
        "env": {"GITHUB_REF_TYPE": "tag", "GITHUB_REF_NAME": "v1.2.3-rc"},
        "git": {GIT_HEAD: "abc1234def5678"},
        "error": "vX.Y.Z",
    },
    {
        "name": "master push without a release description is rejected",
        "env": {"GITHUB_REF_NAME": "master", "GITHUB_EVENT_NAME": "push"},
        "git": {GIT_HEAD: "abc1234def5678"},
        "error": "missing fake git output",
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
        "commit_sha": expected["commit"],
        "should_push_image": expected["should_push_image"],
    }


class ResolveImageIdentityTest(unittest.TestCase):
    def test_identity_decision_table(self):
        for case in IMAGE_IDENTITY_CASES:
            with self.subTest(name=case["name"]):
                if "error" in case:
                    with self.assertRaisesRegex(ImageIdentityError, case["error"]):
                        resolve_identity(identity_env(case["env"]), fake_git(case["git"]))
                else:
                    self.assertEqual(
                        resolve_identity(identity_env(case["env"]), fake_git(case["git"])),
                        expected_identity(case["expected"]),
                    )


if __name__ == "__main__":
    unittest.main()
