"""Validate release metadata invariants."""

import json
import sys
from pathlib import Path

def read_json(path):
    """Read a UTF-8 JSON file used by release automation."""

    return json.loads(Path(path).read_text(encoding="utf-8"))


def fail(message):
    print(message, file=sys.stderr)
    sys.exit(1)


def main():
    """Check that release versioning remains tag-driven, not package-driven."""

    release_config = read_json(".github/utils/release-please-config.json")
    release_manifest = read_json(".github/utils/.release-please-manifest.json")
    package_json = read_json("package.json")

    if release_config.get("include-v-in-tag") is not True:
        fail("Release Please must include v in tags")

    if release_config.get("include-component-in-tag") is not False:
        fail("Release Please must not include component names in tags")

    if "." not in release_manifest:
        fail("Release Please manifest must track the root package")

    if "version" in package_json:
        fail("package.json must not be a release version source")


if __name__ == "__main__":
    main()
