import json
import sys
from pathlib import Path

from production_manifest import ManifestError, validate_production_manifest


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def fail(message):
    print(message, file=sys.stderr)
    sys.exit(1)


def main():
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

    try:
        validate_production_manifest("deploy/production/app.yaml")
    except ManifestError as error:
        fail(str(error))


if __name__ == "__main__":
    main()
