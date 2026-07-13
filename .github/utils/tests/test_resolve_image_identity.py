"""Test container image identity and push-policy resolution.

Purpose:
- Protect GHCR image naming, version derivation, and push decisions.
Fixtures:
- Fake GitHub context values and a fake git runner with deterministic command
  outputs.
Coverage:
- Release tags publish canonical release images.
- Master pushes publish development images unless HEAD is already release-tagged.
- Pull requests receive non-publishing build tags.
- Missing required release history fails explicitly.
Boundaries:
- Does not use real git history, Docker, GHCR, or GitHub Actions.
"""

import unittest

import sys
from pathlib import Path
from collections.abc import Sequence

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from resolve_image_identity import (  # noqa: E402
    ImageIdentityError,
    parse_extended_version,
    release_please_version,
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


class ResolveImageIdentityTest(unittest.TestCase):
    def test_parses_extended_version_with_padded_distance(self):
        self.assertEqual(
            parse_extended_version("v0.2.0-48-gc08fdca"),
            "0.2.0-0048-gc08fdca",
        )

    def test_parses_release_please_subject_with_pull_request_suffix(self):
        self.assertEqual(
            release_please_version("chore: release v0.6.0 (#50)"),
            "0.6.0",
        )

    def test_ignores_non_release_please_subject(self):
        self.assertIsNone(release_please_version("feat(game): add room options"))

    def test_release_tag_publishes_canonical_release_image(self):
        outputs = resolve_identity(
            {
                "GITHUB_REPOSITORY": "Optiplex331/Halligalli-Bossyang",
                "GITHUB_REF_TYPE": "tag",
                "GITHUB_REF_NAME": "v0.3.0",
                "GITHUB_EVENT_NAME": "push",
                "GITHUB_SHA": "abc1234def5678",
            },
            fake_git({("rev-parse", "HEAD"): "abc1234def5678"}),
        )

        self.assertEqual(outputs["version"], "0.3.0")
        self.assertEqual(outputs["web_image_tag"], "ghcr.io/optiplex331/halligalli-bossyang-web:0.3.0")
        self.assertEqual(outputs["api_image_tag"], "ghcr.io/optiplex331/halligalli-bossyang-api:0.3.0")
        self.assertEqual(outputs["should_push_image"], "true")

    def test_master_push_publishes_development_image(self):
        outputs = resolve_identity(
            {
                "GITHUB_REPOSITORY": "owner/repo",
                "GITHUB_REF_TYPE": "branch",
                "GITHUB_REF_NAME": "master",
                "GITHUB_EVENT_NAME": "push",
                "GITHUB_SHA": "c08fdcaf00d1234",
            },
            fake_git(
                {
                    ("rev-parse", "HEAD"): "c08fdcaf00d1234",
                    ("log", "-1", "--pretty=%s"): "feat(game): add room options",
                    (
                        "describe",
                        "--tags",
                        "--first-parent",
                        "--long",
                        "--abbrev=7",
                        "--match",
                        "v[0-9]*.[0-9]*.[0-9]*",
                    ): "v0.2.0-48-gc08fdca",
                }
            ),
        )

        self.assertEqual(outputs["version"], "0.2.0-0048-gc08fdca")
        self.assertEqual(outputs["web_image_tag"], "ghcr.io/owner/repo-web:0.2.0-0048-gc08fdca")
        self.assertEqual(outputs["api_image_tag"], "ghcr.io/owner/repo-api:0.2.0-0048-gc08fdca")
        self.assertEqual(outputs["should_push_image"], "true")

    def test_master_push_on_exact_release_tag_does_not_publish_development_image(self):
        outputs = resolve_identity(
            {
                "GITHUB_REPOSITORY": "owner/repo",
                "GITHUB_REF_TYPE": "branch",
                "GITHUB_REF_NAME": "master",
                "GITHUB_EVENT_NAME": "push",
                "GITHUB_SHA": "abc1234def5678",
            },
            fake_git(
                {
                    ("rev-parse", "HEAD"): "abc1234def5678",
                    (
                        "describe",
                        "--tags",
                        "--exact-match",
                        "--match",
                        "v[0-9]*.[0-9]*.[0-9]*",
                        "HEAD",
                    ): "v0.3.0",
                }
            ),
        )

        self.assertEqual(outputs["version"], "0.3.0")
        self.assertEqual(outputs["should_push_image"], "false")

    def test_release_please_commit_does_not_publish_development_image(self):
        outputs = resolve_identity(
            {
                "GITHUB_REPOSITORY": "owner/repo",
                "GITHUB_REF_TYPE": "branch",
                "GITHUB_REF_NAME": "master",
                "GITHUB_EVENT_NAME": "push",
                "GITHUB_SHA": "abc1234def5678",
            },
            fake_git(
                {
                    ("rev-parse", "HEAD"): "abc1234def5678",
                    ("log", "-1", "--pretty=%s"): "chore: release v0.6.0 (#50)",
                }
            ),
        )

        self.assertEqual(outputs["version"], "0.6.0")
        self.assertEqual(outputs["web_image_tag"], "ghcr.io/owner/repo-web:0.6.0")
        self.assertEqual(outputs["should_push_image"], "false")

    def test_release_please_commit_without_pr_suffix_does_not_publish(self):
        outputs = resolve_identity(
            {
                "GITHUB_REPOSITORY": "owner/repo",
                "GITHUB_REF_TYPE": "branch",
                "GITHUB_REF_NAME": "master",
                "GITHUB_EVENT_NAME": "push",
                "GITHUB_SHA": "abc1234def5678",
            },
            fake_git(
                {
                    ("rev-parse", "HEAD"): "abc1234def5678",
                    ("log", "-1", "--pretty=%s"): "chore: release v0.6.0",
                }
            ),
        )

        self.assertEqual(outputs["version"], "0.6.0")
        self.assertEqual(outputs["should_push_image"], "false")

    def test_pull_request_does_not_publish(self):
        outputs = resolve_identity(
            {
                "GITHUB_REPOSITORY": "owner/repo",
                "GITHUB_REF_TYPE": "branch",
                "GITHUB_REF_NAME": "feature",
                "GITHUB_EVENT_NAME": "pull_request",
                "GITHUB_SHA": "abc1234def5678",
            },
            fake_git({("rev-parse", "HEAD"): "abc1234def5678"}),
        )

        self.assertEqual(outputs["version"], "pr-abc1234")
        self.assertEqual(outputs["should_push_image"], "false")

    def test_master_push_fails_without_prior_release_tag(self):
        with self.assertRaisesRegex(ImageIdentityError, "missing fake git output"):
            resolve_identity(
                {
                    "GITHUB_REPOSITORY": "owner/repo",
                    "GITHUB_REF_TYPE": "branch",
                    "GITHUB_REF_NAME": "master",
                    "GITHUB_EVENT_NAME": "push",
                    "GITHUB_SHA": "abc1234def5678",
                },
                fake_git({("rev-parse", "HEAD"): "abc1234def5678"}),
            )


if __name__ == "__main__":
    unittest.main()
