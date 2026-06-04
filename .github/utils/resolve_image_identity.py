"""Resolve GHCR image identity for release, master, and pull request builds."""

import re
import subprocess
import sys

from release_utils import append_github_outputs


RELEASE_TAG_PATTERN = "v[0-9]*.[0-9]*.[0-9]*"
RELEASE_TAG_RE = re.compile(r"^v[0-9]+\.[0-9]+\.[0-9]+$")


class ImageIdentityError(Exception):
    """Raised when GitHub context or git history cannot produce an image identity."""

    pass


def normalize_image(repository):
    """Convert owner/repo from GitHub context into the canonical GHCR image name."""

    if not repository:
        raise ImageIdentityError("GITHUB_REPOSITORY must be set")
    return f"ghcr.io/{repository}".lower()


def short_sha(commit_sha):
    """Return the seven-character identity used for non-publishing PR builds."""

    if len(commit_sha) < 7:
        raise ImageIdentityError("Commit SHA must be at least 7 characters")
    return commit_sha[:7]


def parse_extended_version(describe):
    """Convert git-describe output into the development image tag format."""

    match = re.fullmatch(r"v([0-9]+\.[0-9]+\.[0-9]+)-([0-9]+)-g([0-9a-fA-F]+)", describe)
    if not match:
        raise ImageIdentityError(f"Unexpected git describe output: {describe}")

    base, count, git_ref = match.groups()
    return f"{base}-{int(count):04d}-g{git_ref}"


def is_release_tag(ref_type, ref_name):
    """Release tags are the only refs that may publish canonical release images."""

    return ref_type == "tag" and RELEASE_TAG_RE.fullmatch(ref_name or "") is not None


def is_master_push(event_name, ref_type, ref_name):
    """Normal master pushes may publish Development GHCR Images."""

    return event_name == "push" and ref_type == "branch" and ref_name == "master"


def run_git(args, allow_failure=False):
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


def resolve_identity(env, git=run_git):
    """Resolve image tag, version, commit SHA, and publish/promotion decisions."""

    image = normalize_image(env.get("GITHUB_REPOSITORY", ""))
    ref_type = env.get("GITHUB_REF_TYPE", "")
    ref_name = env.get("GITHUB_REF_NAME", "")
    event_name = env.get("GITHUB_EVENT_NAME", "")
    commit_sha = git(["rev-parse", "HEAD"])
    should_push_image = False

    if is_release_tag(ref_type, ref_name):
        # Release-tag builds are canonical release artifacts. AWS scaffold
        # rollout is manual through the AWS Production Scaffold workflow.
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
            allow_failure=True,
        )
        if exact_tag:
            version = exact_tag.removeprefix("v")
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
        "image": image,
        "version": version,
        "image_tag": f"{image}:{version}",
        "commit_sha": commit_sha,
        "should_push_image": str(should_push_image).lower(),
    }


def main():
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
