"""Fail the workflow when live DO Production differs from the manifest."""

import json
import os
import sys
from pathlib import Path

from production_manifest import (
    ManifestError,
    append_github_outputs,
    compare_production_manifest_to_live_spec,
)


def main():
    """Compare SPEC_PATH with LIVE_SPEC_PATH and emit release identity outputs."""

    spec_path = os.environ.get("SPEC_PATH", "deploy/production/app.yaml")
    live_spec_path = os.environ.get("LIVE_SPEC_PATH", "live-app-spec.json")

    try:
        result = compare_production_manifest_to_live_spec(
            Path(spec_path).read_text(encoding="utf-8"),
            json.loads(Path(live_spec_path).read_text(encoding="utf-8")),
        )

        if result["drift"]:
            print("Production drift detected:", file=sys.stderr)
            for line in result["drift"]:
                print(f"- {line}", file=sys.stderr)
            sys.exit(1)

        outputs = {
            "app_version": result["identity"]["appVersion"],
            "commit_sha": result["identity"]["commitSha"],
            "image_digest": result["identity"]["imageDigest"],
        }

        for line in append_github_outputs(outputs):
            print(line)
    except (ManifestError, json.JSONDecodeError, OSError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
