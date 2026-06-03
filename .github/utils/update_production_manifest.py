"""Update the Git-tracked Production Manifest with a new release identity."""

import os
import sys

from production_manifest import ManifestError, write_release_identity


def main():
    """Read VERSION, COMMIT_SHA, and IMAGE_DIGEST from the workflow environment."""

    try:
        write_release_identity(
            os.environ.get("SPEC_PATH", "deploy/production/app.yaml"),
            {
                "appVersion": os.environ.get("VERSION"),
                "commitSha": os.environ.get("COMMIT_SHA"),
                "imageDigest": os.environ.get("IMAGE_DIGEST"),
            },
        )
    except ManifestError as error:
        print(error, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
