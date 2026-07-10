"""Build and validate immutable provenance for a formal Release Tag image."""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


RELEASE_TAG_RE = re.compile(r"^v[0-9]+\.[0-9]+\.[0-9]+$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")


class ReleaseAttestationError(ValueError):
    """Raised when release provenance is incomplete or internally inconsistent."""


def build_release_attestation(
    *, tag: str, commit: str, image: str, digest: str
) -> dict[str, Any]:
    """Return the formal-release provenance contract consumed by Infrastructure."""

    if not RELEASE_TAG_RE.fullmatch(tag):
        raise ReleaseAttestationError("Attestation requires a formal release tag")
    if not COMMIT_RE.fullmatch(commit):
        raise ReleaseAttestationError("Attestation requires a full lowercase commit SHA")
    if not DIGEST_RE.fullmatch(digest):
        raise ReleaseAttestationError("Attestation requires an immutable sha256 digest")

    repository, separator, image_tag = image.rpartition(":")
    version = tag.removeprefix("v")
    if not separator or not repository or image_tag != version:
        raise ReleaseAttestationError("Image tag must match the formal release version")

    return {
        "schemaVersion": 1,
        "releaseTag": tag,
        "commit": commit,
        "image": {"repository": repository, "tag": image_tag, "digest": digest},
        "runtimeIdentity": {"version": version, "commit": commit},
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tag", required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--image", required=True)
    parser.add_argument("--digest", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    try:
        attestation = build_release_attestation(
            tag=args.tag, commit=args.commit, image=args.image, digest=args.digest
        )
        Path(args.output).write_text(
            json.dumps(attestation, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
    except ReleaseAttestationError as error:
        print(error, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
