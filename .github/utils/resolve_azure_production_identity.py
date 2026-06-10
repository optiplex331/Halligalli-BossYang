"""Resolve Azure Production deployment image identity."""

from __future__ import annotations

import os
import sys

from release_utils import append_github_outputs
from resolve_image_identity import (
    ImageIdentityError,
    is_release_tag,
    normalize_image,
    run_git,
)


def required(env: dict[str, str], name: str) -> str:
    value = env.get(name, "").strip()
    if not value:
        raise ImageIdentityError(f"{name} must be set")
    return value


def resolve_azure_production_identity(env: dict[str, str], git=run_git) -> dict[str, str]:
    """Resolve the GHCR backend Release Image selected for Azure Production deployment."""

    image = normalize_image(required(env, "GITHUB_REPOSITORY"))
    ref_type = env.get("GITHUB_REF_TYPE", "")
    ref_name = env.get("GITHUB_REF_NAME", "")
    commit_sha = git(["rev-parse", "HEAD"])

    if not is_release_tag(ref_type, ref_name):
        raise ImageIdentityError("Azure Production deploy-backend requires a vX.Y.Z Release Tag ref")

    version = ref_name.removeprefix("v")

    return {
        "version": version,
        "image": image,
        "image_tag": f"{image}:{version}",
        "commit_sha": commit_sha,
    }


def main() -> None:
    """CLI entry point used by GitHub Actions steps."""

    try:
        outputs = resolve_azure_production_identity(dict(os.environ))
        for line in append_github_outputs(outputs):
            print(line)
    except (ImageIdentityError, ValueError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
