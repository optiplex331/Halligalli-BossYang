"""Build the schema-V2 manifest that binds one formal Paired Release."""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


RELEASE_TAG_RE = re.compile(r"^v[0-9]+\.[0-9]+\.[0-9]+$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")


class PairedReleaseManifestError(ValueError):
    """Raised when a paired release manifest is incomplete or inconsistent."""


def _image_record(image: str, digest: str, version: str) -> dict[str, str]:
    repository, separator, image_tag = image.rpartition(":")
    if not separator or not repository or image_tag != version:
        raise PairedReleaseManifestError("Image tags must match the formal release version")
    if not DIGEST_RE.fullmatch(digest):
        raise PairedReleaseManifestError("Manifest requires immutable sha256 digests")
    return {"repository": repository, "tag": image_tag, "digest": digest}


def build_paired_release_manifest(
    *, tag: str, commit: str, web_image: str, web_digest: str, api_image: str, api_digest: str
) -> dict[str, Any]:
    """Return a release binding; GitHub attestations remain security provenance."""

    if not RELEASE_TAG_RE.fullmatch(tag):
        raise PairedReleaseManifestError("Manifest requires a formal release tag")
    if not COMMIT_RE.fullmatch(commit):
        raise PairedReleaseManifestError("Manifest requires a full lowercase commit SHA")
    version = tag.removeprefix("v")
    if not all((web_image, web_digest, api_image, api_digest)):
        raise PairedReleaseManifestError("Manifest requires both Web and API images and digests")

    return {
        "schemaVersion": 2,
        "releaseTag": tag,
        "commit": commit,
        "images": {
            "web": _image_record(web_image, web_digest, version),
            "api": _image_record(api_image, api_digest, version),
        },
        "runtimeIdentity": {"version": version, "commit": commit},
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    for name in ("tag", "commit", "web-image", "web-digest", "api-image", "api-digest", "output"):
        parser.add_argument(f"--{name}", required=True)
    args = parser.parse_args()
    try:
        manifest = build_paired_release_manifest(
            tag=args.tag,
            commit=args.commit,
            web_image=args.web_image,
            web_digest=args.web_digest,
            api_image=args.api_image,
            api_digest=args.api_digest,
        )
        Path(args.output).write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    except PairedReleaseManifestError as error:
        print(error, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
