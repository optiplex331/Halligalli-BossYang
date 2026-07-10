"""Fail-closed publication decisions for a formal Release Attestation asset."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

from release_utils import append_github_outputs


class ReleaseAssetError(ValueError):
    """Raised when an existing Release asset conflicts with new provenance."""


def assess_release_asset(candidate: bytes, existing: bytes | None) -> dict[str, str]:
    """Return whether to upload or reuse an identical existing Release asset."""

    candidate_digest = hashlib.sha256(candidate).hexdigest()
    if existing is None:
        return {"action": "upload", "sha256": candidate_digest}
    if hashlib.sha256(existing).hexdigest() != candidate_digest:
        raise ReleaseAssetError(
            "release-attestation.json already exists with different contents"
        )
    return {"action": "reuse", "sha256": candidate_digest}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", required=True, type=Path)
    parser.add_argument("--existing", type=Path)
    args = parser.parse_args()

    try:
        assessment = assess_release_asset(
            args.candidate.read_bytes(),
            args.existing.read_bytes()
            if args.existing and args.existing.is_file()
            else None,
        )
        append_github_outputs(
            assessment,
            output_path=os.environ.get("GITHUB_OUTPUT", ""),
        )
        print(json.dumps(assessment, sort_keys=True))
    except (OSError, ReleaseAssetError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
