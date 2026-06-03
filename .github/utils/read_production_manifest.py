"""Emit release identity from the Git-tracked Production Manifest."""

import os
import sys

from production_manifest import (
    ManifestError,
    append_github_outputs,
    read_release_identity,
)


def main():
    """Read SPEC_PATH and write image/version/commit outputs for workflows."""

    try:
        identity = read_release_identity(
            os.environ.get("SPEC_PATH", "deploy/production/app.yaml")
        )
        outputs = {
            "image_digest": identity["imageDigest"],
            "app_version": identity["appVersion"],
            "commit_sha": identity["commitSha"],
        }

        for line in append_github_outputs(outputs):
            print(line)
    except ManifestError as error:
        print(error, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
