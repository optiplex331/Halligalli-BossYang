"""Resolve GHCR image identity and push policy for container builds.

Purpose:
- Give the Container workflow a deterministic image name, version, tag, commit,
  and push decision.
Inputs:
- GitHub environment: GITHUB_REPOSITORY, GITHUB_REF_TYPE, GITHUB_REF_NAME,
  GITHUB_EVENT_NAME, GITHUB_SHA.
- Local git history and release tags.
Outputs:
- GitHub step outputs: web_image_tag, api_image_tag, version, commit_sha,
  should_push_image.
Boundaries:
- Does not build, scan, push, or deploy images.
- Does not choose the production digest; the infrastructure repo owns that.
"""

import re
import subprocess
import sys
from collections.abc import Callable, Sequence
from typing import Mapping, Optional

from release_utils import append_github_outputs

RELEASE_TAG_PATTERN = "v[0-9]*.[0-9]*.[0-9]*"
RELEASE_TAG_RE = re.compile(r"^v[0-9]+\.[0-9]+\.[0-9]+$")
RELEASE_PLEASE_SUBJECT_RE = re.compile(
    r"^chore: release v(?P<version>[0-9]+\.[0-9]+\.[0-9]+)(?: \(#[0-9]+\))?$"
)


class ImageIdentityError(Exception):
    """Raised when GitHub context or git history cannot produce an image identity."""

    pass


def normalize_image(repository: str) -> str:
    """Convert owner/repo from GitHub context into the canonical GHCR image name."""

    if not repository:
        raise ImageIdentityError("GITHUB_REPOSITORY must be set")
    return f"ghcr.io/{repository}".lower()


def short_sha(commit_sha: str) -> str:
    """Return the seven-character identity used for non-publishing PR builds."""

    if len(commit_sha) < 7:
        raise ImageIdentityError("Commit SHA must be at least 7 characters")
    return commit_sha[:7]


def parse_extended_version(describe: str) -> str:
    """Convert git-describe output into the development image tag format."""

    match = re.fullmatch(
        r"v([0-9]+\.[0-9]+\.[0-9]+)-([0-9]+)-g([0-9a-fA-F]+)", describe
    )
    if not match:
        raise ImageIdentityError(f"Unexpected git describe output: {describe}")

    base, count, git_ref = match.groups()
    return f"{base}-{int(count):04d}-g{git_ref}"


def is_release_tag(ref_type: str, ref_name: str) -> bool:
    """Release tags are the only refs that may publish canonical release images."""

    return ref_type == "tag" and RELEASE_TAG_RE.fullmatch(ref_name or "") is not None


def is_master_push(event_name: str, ref_type: str, ref_name: str) -> bool:
    """Master product-runtime pushes may publish Development GHCR Images."""

    return event_name == "push" and ref_type == "branch" and ref_name == "master"


def release_please_version(subject: str) -> Optional[str]:
    """Return the Release Please version from a release commit subject."""

    match = RELEASE_PLEASE_SUBJECT_RE.fullmatch(subject)
    if match is None:
        return None
    return match.group("version")


def release_please_commit_version(
    git: Callable[[Sequence[str], bool], str],
) -> Optional[str]:
    """Return the Release Please version from the current commit subject."""

    return release_please_version(git(["log", "-1", "--pretty=%s"], False))


def run_git(args: Sequence[str], allow_failure: bool = False) -> str:
    """Run git and return trimmed stdout, optionally treating failure as empty."""

    result = subprocess.run(
        ["git", *args],
        check=False,
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        return result.stdout.strip()

    if allow_failure:
        return ""

    message = result.stderr.strip() or result.stdout.strip() or "git command failed"
    raise ImageIdentityError(message)


def resolve_identity(
    env: Mapping[str, str],
    git: Callable[[Sequence[str], bool], str] = run_git,
) -> dict[str, str]:
    """Resolve image tag, version, commit SHA, and publish/promotion decisions."""

    image = normalize_image(env.get("GITHUB_REPOSITORY", ""))
    ref_type = env.get("GITHUB_REF_TYPE", "")
    ref_name = env.get("GITHUB_REF_NAME", "")
    event_name = env.get("GITHUB_EVENT_NAME", "")
    commit_sha = git(["rev-parse", "HEAD"], False)
    should_push_image = False

    if is_release_tag(ref_type, ref_name):
        # Release-tag builds are canonical paired GHCR artifacts. The
        # infrastructure repo deploys reviewed image digests through GitOps.
        version = ref_name.removeprefix("v")
        should_push_image = True
    elif is_master_push(event_name, ref_type, ref_name):
        # If master is already at a release tag, do not duplicate it as a
        # development image. Otherwise derive a first-parent development tag.
        exact_tag = git(
            [
                "describe",
                "--tags",
                "--exact-match",
                "--match",
                RELEASE_TAG_PATTERN,
                "HEAD",
            ],
            True,
        )
        if exact_tag:
            version = exact_tag.removeprefix("v")
        else:
            # Release Please may create the tag after the master workflow has
            # already started, so also recognize the release commit itself.
            release_commit_version = release_please_commit_version(git)
            if release_commit_version:
                version = release_commit_version
            else:
                describe = git(
                    [
                        "describe",
                        "--tags",
                        "--first-parent",
                        "--long",
                        "--abbrev=7",
                        "--match",
                        RELEASE_TAG_PATTERN,
                    ]
                )
                version = parse_extended_version(describe)
                should_push_image = True
    else:
        # Pull request and other non-publishing contexts still get a stable tag
        # for logs and local workflow plumbing.
        version = f"pr-{short_sha(env.get('GITHUB_SHA', commit_sha))}"

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
        outputs = resolve_identity(dict(__import__("os").environ))
        for line in append_github_outputs(outputs):
            print(line)
    except ImageIdentityError as error:
        print(error, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
