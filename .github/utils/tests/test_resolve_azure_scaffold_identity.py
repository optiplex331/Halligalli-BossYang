"""Tests for Azure Production Scaffold image identity routing."""

import unittest

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from resolve_azure_scaffold_identity import resolve_azure_scaffold_identity  # noqa: E402
from resolve_image_identity import ImageIdentityError  # noqa: E402


def fake_git(outputs):
    """Provide deterministic git command results to the resolver under test."""

    def run(args, allow_failure=False):
        key = tuple(args)
        if key in outputs:
            return outputs[key]
        if allow_failure:
            return ""
        raise ImageIdentityError(f"missing fake git output for {key}")

    return run


class ResolveAzureScaffoldIdentityTest(unittest.TestCase):
    def base_env(self):
        return {
            "GITHUB_REPOSITORY": "Optiplex331/Halligalli-BossYang",
        }

    def test_release_mode_accepts_release_tag(self):
        env = {
            **self.base_env(),
            "GITHUB_REF_TYPE": "tag",
            "GITHUB_REF_NAME": "v0.4.0",
        }

        outputs = resolve_azure_scaffold_identity(
            env,
            fake_git({("rev-parse", "HEAD"): "abc1234def5678"}),
        )

        self.assertEqual(outputs["version"], "0.4.0")
        self.assertEqual(outputs["image"], "ghcr.io/optiplex331/halligalli-bossyang")
        self.assertEqual(outputs["image_tag"], "ghcr.io/optiplex331/halligalli-bossyang:0.4.0")
        self.assertEqual(outputs["commit_sha"], "abc1234def5678")

    def test_release_mode_rejects_non_tag_ref(self):
        env = {
            **self.base_env(),
            "GITHUB_REF_TYPE": "branch",
            "GITHUB_REF_NAME": "master",
        }

        with self.assertRaisesRegex(ImageIdentityError, "requires a vX.Y.Z Release Tag"):
            resolve_azure_scaffold_identity(env, fake_git({("rev-parse", "HEAD"): "abc1234"}))


if __name__ == "__main__":
    unittest.main()
