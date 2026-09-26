"""Resolve GHCR image identity and push policy for container builds.

Release Tags (vX.Y.Z) publish canonical paired images. Every other context
builds non-publishing pr-<short-sha> images for scanning and smoke tests.
"""

import os
import re
import sys
from typing import Mapping

from release_utils import write_github_outputs

RELEASE_TAG_RE = re.compile(r"^v[0-9]+\.[0-9]+\.[0-9]+$")


class ImageIdentityError(Exception):
    """Raised when GitHub context cannot produce an image identity."""


def normalize_image(repository: str) -> str:
    """Convert owner/repo from GitHub context into the canonical GHCR image name."""

    if not repository:
        raise ImageIdentityError("GITHUB_REPOSITORY must be set")
    return f"ghcr.io/{repository}".lower()


def resolve_identity(env: Mapping[str, str]) -> dict[str, str]:
    """Resolve image tag, version, commit SHA, and publish decision."""

    image = normalize_image(env.get("GITHUB_REPOSITORY", ""))
    commit_sha = env.get("GITHUB_SHA", "")
    if len(commit_sha) < 7:
        raise ImageIdentityError("GITHUB_SHA must be a commit SHA")

    if env.get("GITHUB_REF_TYPE") == "tag":
        ref_name = env.get("GITHUB_REF_NAME", "")
        if not RELEASE_TAG_RE.fullmatch(ref_name):
            raise ImageIdentityError("Release tag must match vX.Y.Z")
        version = ref_name.removeprefix("v")
        should_push_image = True
    else:
        version = f"pr-{commit_sha[:7]}"
        should_push_image = False

    return {
        "version": version,
        "web_image": f"{image}-web",
        "api_image": f"{image}-api",
        "web_image_tag": f"{image}-web:{version}",
        "api_image_tag": f"{image}-api:{version}",
        "commit_sha": commit_sha,
        "should_push_image": str(should_push_image).lower(),
    }


def main() -> None:
    """CLI entry point used by GitHub Actions steps."""

    try:
        write_github_outputs(resolve_identity(os.environ))
    except ImageIdentityError as error:
        print(error, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
